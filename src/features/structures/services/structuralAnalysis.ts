import type {
  CarbonMaterial,
  LaminatePly,
  StructuralAnalysisResult,
  StructuralDesign,
  StructuralLoadCase,
  StructuralResultPoint,
  StructuralTubeSection,
} from "../model/types";

type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]];

export interface LaminateProperties {
  thickness: number;
  a: Matrix3;
  b: Matrix3;
  d: Matrix3;
  effectiveEx: number;
  effectiveEy: number;
  effectiveNuXY: number;
  effectiveGxy: number;
  arealMass: number;
}

export function calculateLaminate(plies: readonly LaminatePly[], materials: ReadonlyMap<string, CarbonMaterial>): LaminateProperties {
  const expanded = plies.flatMap((ply) => Array.from({ length: ply.count }, () => ({ ply, material: requireMaterial(materials, ply.materialId) })));
  if (!expanded.length) throw new Error("積層には1層以上が必要です。");
  const thickness = expanded.reduce((sum, item) => sum + item.material.plyThickness, 0);
  const a = zeroMatrix();
  const b = zeroMatrix();
  const d = zeroMatrix();
  let z = -thickness / 2;
  let arealMass = 0;

  for (const { ply, material } of expanded) {
    const nextZ = z + material.plyThickness;
    const q = transformedReducedStiffness(material, ply.angle);
    addScaled(a, q, nextZ - z);
    addScaled(b, q, (nextZ ** 2 - z ** 2) / 2);
    addScaled(d, q, (nextZ ** 3 - z ** 3) / 3);
    arealMass += material.density * material.plyThickness;
    z = nextZ;
  }

  const compliance = invert3(a);
  return {
    thickness,
    a,
    b,
    d,
    effectiveEx: 1 / (compliance[0][0] * thickness),
    effectiveEy: 1 / (compliance[1][1] * thickness),
    effectiveNuXY: -compliance[0][1] / compliance[0][0],
    effectiveGxy: 1 / (compliance[2][2] * thickness),
    arealMass,
  };
}

export function calculateTubeLinearMass(section: StructuralTubeSection, materials: ReadonlyMap<string, CarbonMaterial>) {
  return buildCircumferenceCells(section, materials).reduce((sum, cell) => sum + cell.plies.reduce(
    (cellSum, ply) => cellSum + ply.material.density * sectorArea(ply.innerRadius, ply.outerRadius, cell.dTheta),
    0,
  ), 0);
}

export function executeStructuralAnalysis({
  design,
  loadCase,
  materials,
  resultId,
  sampleCount = 161,
}: {
  design: StructuralDesign;
  loadCase: StructuralLoadCase;
  materials: readonly CarbonMaterial[];
  resultId: string;
  sampleCount?: number;
}): StructuralAnalysisResult {
  validateInputs(design, loadCase, materials);
  const materialMap = new Map(materials.map((material) => [material.id, material]));
  const tubeSections = design.sections;
  const span = tubeSections.reduce((sum, section) => sum + section.length, 0);
  const count = Math.max(3, Math.round(sampleCount));
  const y = Array.from({ length: count }, (_, index) => span * index / (count - 1));
  const factor = loadCase.loadFactor * loadCase.safetyFactor;
  const q = y.map((position) => interpolateLoad(loadCase, position, "liftPerLength") * factor);
  const distributedTorque = y.map((position) => interpolateLoad(loadCase, position, "torquePerLength") * factor);
  const distributedShear = new Array<number>(count).fill(0);
  const distributedMoment = new Array<number>(count).fill(0);
  const distributedTorqueResult = new Array<number>(count).fill(0);
  const pointLoads = loadCase.pointLoads.map((load) => ({ ...load, force: load.force * factor, torque: load.torque * factor }));
  const sectionProperties = tubeSections.map((section) => tubeSectionProperties(section, materialMap));
  const sections = y.map((position) => sectionAt(tubeSections, sectionProperties, position));

  for (let index = count - 2; index >= 0; index -= 1) {
    const dx = y[index + 1] - y[index];
    distributedShear[index] = distributedShear[index + 1] + (q[index] + q[index + 1]) * dx / 2;
    distributedTorqueResult[index] = distributedTorqueResult[index + 1] + (distributedTorque[index] + distributedTorque[index + 1]) * dx / 2;
    distributedMoment[index] = distributedMoment[index + 1] + (distributedShear[index] + distributedShear[index + 1]) * dx / 2;
  }
  const baseShear = y.map((position, index) => distributedShear[index] + pointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.force, 0));
  const baseMoment = momentFromPoints(y, distributedMoment, pointLoads);
  const baseTorque = y.map((position, index) => distributedTorqueResult[index] + pointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.torque, 0));
  const baseDeflection = deflectionFromForces(y, baseMoment, baseShear, baseTorque, sections);
  const supports = design.supports ?? [];
  const supportReactions = supports.length ? solveSupportReactions(supports, y, sections, baseDeflection) : [];
  const effectivePointLoads = [...pointLoads, ...supportReactions.map((reaction) => ({ id: reaction.supportId, yPosition: reaction.yPosition, force: reaction.force, torque: 0 }))];
  const shear = y.map((position, index) => distributedShear[index] + effectivePointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.force, 0));
  const moment = momentFromPoints(y, distributedMoment, effectivePointLoads);
  const torque = y.map((position, index) => distributedTorqueResult[index] + effectivePointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.torque, 0));
  const generalizedStrains = sections.map((section, index) => sectionGeneralizedStrain(section, moment[index], torque[index]));
  const curvature = generalizedStrains.map((strain) => strain[1]);
  const twistRate = generalizedStrains.map((strain) => strain[2]);
  const rotation = integrateForward(y, curvature);
  const deflection = integrateForward(y, rotation.map((value, index) => value + shear[index] / sections[index].shearStiffness));
  const twist = integrateForward(y, twistRate);
  const points: StructuralResultPoint[] = y.map((position, index) => createResultPoint({
    yPosition: position,
    distributedLoad: q[index],
    shearForce: shear[index],
    bendingMoment: moment[index],
    torque: torque[index],
    deflection: deflection[index],
    rotation: rotation[index],
    twist: twist[index],
  }, sections[index]));
  const governing = points.reduce((current, point) => point.minReserveFactor < current.minReserveFactor ? point : current, points[0]);
  const mass = tubeSections.reduce((sum, section, index) => sum + sectionProperties[index].linearMass * section.length, 0);
  const externalForce = trapezoid(y, q) + effectivePointLoads.reduce((sum, load) => sum + load.force, 0);
  const externalMoment = trapezoid(y, q.map((load, index) => load * y[index])) + effectivePointLoads.reduce((sum, load) => sum + load.force * load.yPosition, 0);

  return {
    id: resultId,
    designId: design.id,
    loadCaseId: loadCase.id,
    status: "completed",
    createdAt: new Date().toISOString(),
    designSnapshot: cloneDesign(design),
    loadCaseSnapshot: cloneLoadCase(loadCase),
    materialIds: Array.from(new Set(tubeSections.flatMap((section) => section.plies.map((ply) => ply.materialId)))),
    materialSnapshots: materials.filter((material) => tubeSections.some((section) => section.plies.some((ply) => ply.materialId === material.id))).map((material) => ({ ...material })),
    points,
    summary: {
      mass,
      maxDeflection: Math.max(...deflection.map(Math.abs)),
      maxTwist: Math.max(...twist.map(Math.abs)),
      minReserveFactor: governing.minReserveFactor,
      governingLoadCase: loadCase.name,
      governingPosition: governing.yPosition,
      governingPlyId: governing.criticalPlyId,
      governingMode: governing.criticalMode,
      reactionForce: -shear[0],
      reactionMoment: -moment[0],
      forceBalanceError: Math.abs(externalForce - shear[0]),
      momentBalanceError: Math.abs(externalMoment - moment[0]),
      supportReactions,
      analysisWarnings: createAnalysisWarnings(design, materialMap, Math.max(...deflection.map(Math.abs)), span),
    },
  };
}

function createAnalysisWarnings(design: StructuralDesign, materials: ReadonlyMap<string, CarbonMaterial>, maxDeflection: number, span: number) {
  const warnings = [
    "層内強度は線形積層理論による膜内応力とHashin初期層破壊で評価しています。層間剥離と破壊進展は含みません。",
    "たわみはTimoshenko梁近似です。全周積層では積層の面内せん断弾性率と有効せん断面積A/2、部分積層では断面ねじり剛性からの薄肉円管換算を使用しています。",
    "局部座屈とBrazier扁平化は、全周積層区間に限り、純曲げを受ける完全円筒の弾性スクリーニングで評価します。初期不整・製造ばらつきのノックダウンと、せん断・ねじり相互作用は含みません。",
    "支持部、継手、接着端、穴、積層終了部の局所応力と層間破壊は別途詳細解析・試験が必要です。",
  ];
  if (design.sections.some((section) => section.plies.some((ply) => (ply.partialAngle ?? 90) < 90))) warnings.push("部分積層は上下対称キャップの実配置を周方向に積分し、存在する位置の局所積層で応力を評価しています。段付き肉厚のシェル座屈・Brazier扁平化、キャップ端部のピール応力と剥離は評価していません。");
  if (design.sections.some((section) => Math.max(...calculateLaminate(section.plies, materials).b.flat().map(Math.abs)) > 1e-6)) warnings.push("非対称積層のB行列は算出していますが、管壁曲率との完全な伸び―曲げ連成はこの1次元断面モデルに含みません。");
  if (span > 0 && maxDeflection / span > 0.1) warnings.push("最大たわみがスパンの10%を超えています。幾何学的非線形解析が必要です。");
  return warnings;
}

interface CircumferentialPly {
  ply: LaminatePly;
  material: CarbonMaterial;
  q: Matrix3;
  innerRadius: number;
  outerRadius: number;
  meanRadius: number;
}

interface CircumferentialCell {
  theta: number;
  dTheta: number;
  plies: CircumferentialPly[];
}

interface SectionProperties {
  outerDiameter: number;
  thickness: number;
  ei: number;
  ea: number;
  gj: number;
  shearStiffness: number;
  linearMass: number;
  secondMoment: number;
  polarMoment: number;
  localBucklingMomentCapacity?: number;
  brazierMomentCapacity?: number;
  bendingMomentCapacity: number;
  bendingFailurePlyId: string;
  bendingFailureMode: string;
  torqueCapacity: number;
  compliance: Matrix3;
  cells: CircumferentialCell[];
  section: StructuralTubeSection;
}

export interface StructuralDesignPropertyPoint {
  yPosition: number;
  sectionId: string;
  /** Laminate first-ply bending strength converted to nominal outer-fiber strength [Pa]. */
  laminateBendingStrength: number;
  /** Ply that first reaches the Hashin failure criterion under bending. */
  laminateFailurePlyId: string;
  /** Hashin mode governing first-ply failure under bending. */
  laminateFailureMode: string;
  /** Perfect-shell local-buckling strength converted to nominal outer-fiber strength [Pa]. */
  localBucklingStrength?: number;
  /** Perfect-shell Brazier ovalization strength converted to nominal outer-fiber strength [Pa]. */
  brazierStrength?: number;
  /** Lowest available bending strength across the evaluated failure modes [Pa]. */
  governingBendingStrength: number;
  /** Section bending stiffness EI [N m²]. */
  bendingStiffness: number;
}

export function calculateStructuralDesignProperties(
  design: StructuralDesign,
  materials: readonly CarbonMaterial[],
): StructuralDesignPropertyPoint[] {
  const materialMap = new Map(materials.map((material) => [material.id, material]));
  let start = 0;

  return design.sections.flatMap((section) => {
    const properties = tubeSectionProperties(section, materialMap);
    const toNominalStrength = (momentCapacity: number) => momentCapacity * (section.outerDiameter / 2) / properties.secondMoment;
    const laminateBendingStrength = toNominalStrength(properties.bendingMomentCapacity);
    const localBucklingStrength = properties.localBucklingMomentCapacity === undefined ? undefined : toNominalStrength(properties.localBucklingMomentCapacity);
    const brazierStrength = properties.brazierMomentCapacity === undefined ? undefined : toNominalStrength(properties.brazierMomentCapacity);
    const governingBendingStrength = Math.min(laminateBendingStrength, localBucklingStrength ?? Number.POSITIVE_INFINITY, brazierStrength ?? Number.POSITIVE_INFINITY);
    const end = start + section.length;
    const values = {
      sectionId: section.id,
      laminateBendingStrength,
      laminateFailurePlyId: properties.bendingFailurePlyId,
      laminateFailureMode: properties.bendingFailureMode,
      localBucklingStrength,
      brazierStrength,
      governingBendingStrength,
      bendingStiffness: properties.ei,
    };
    const points = [{ yPosition: start, ...values }, { yPosition: end, ...values }];
    start = end;
    return points;
  });
}

function sectionAt(sections: readonly StructuralTubeSection[], properties: readonly SectionProperties[], y: number): SectionProperties {
  let endPosition = 0;
  for (let index = 0; index < sections.length; index += 1) {
    endPosition += sections[index].length;
    if (y < endPosition - 1e-10 || index === sections.length - 1) return properties[index];
  }
  return properties.at(-1)!;
}

function tubeSectionProperties(section: StructuralTubeSection, materials: ReadonlyMap<string, CarbonMaterial>): SectionProperties {
  const cells = buildCircumferenceCells(section, materials);
  if (cells.some((cell) => !cell.plies.length)) throw new Error(`パイプセクション ${section.id} は全周を覆う基礎積層が必要です。`);
  const stiffness = sectionStiffness(cells);
  const compliance = invert3(stiffness);
  const ei = 1 / compliance[1][1];
  const ea = 1 / compliance[0][0];
  const gj = 1 / compliance[2][2];
  const maxThickness = section.plies.reduce((sum, ply) => sum + requireMaterial(materials, ply.materialId).plyThickness * ply.count, 0);
  const innerRadius = section.outerDiameter / 2 - maxThickness;
  if (innerRadius <= 0) throw new Error(`パイプセクション ${section.id} の積層厚さが外径を超えています。`);
  const geometry = cells.reduce((total, cell) => {
    for (const ply of cell.plies) {
      const area = sectorArea(ply.innerRadius, ply.outerRadius, cell.dTheta);
      total.area += area;
      total.mass += ply.material.density * area;
      total.secondMoment += Math.sin(cell.theta) ** 2 * (ply.outerRadius ** 4 - ply.innerRadius ** 4) * cell.dTheta / 4;
      total.polarMoment += (ply.outerRadius ** 4 - ply.innerRadius ** 4) * cell.dTheta / 4;
    }
    return total;
  }, { area: 0, mass: 0, secondMoment: 0, polarMoment: 0 });
  const hasPartialPlies = section.plies.some((ply) => (ply.partialAngle ?? 90) < 90);
  let localBucklingMomentCapacity: number | undefined;
  let brazierMomentCapacity: number | undefined;
  let shearStiffness = gj / (2 * (section.outerDiameter / 2 - maxThickness / 2) ** 2);
  if (!hasPartialPlies) {
    const laminate = calculateLaminate(section.plies, materials);
    shearStiffness = 0.5 * laminate.effectiveGxy * geometry.area;
    const meanRadius = section.outerDiameter / 2 - maxThickness / 2;
    const nuYX = laminate.effectiveNuXY * laminate.effectiveEy / laminate.effectiveEx;
    const orthotropicDenominator = Math.sqrt(Math.max(1e-9, 1 - laminate.effectiveNuXY * nuYX));
    const coupledModulus = Math.sqrt(laminate.effectiveEx * laminate.effectiveEy);
    const elasticBucklingStress = coupledModulus * maxThickness / (Math.sqrt(3) * orthotropicDenominator * meanRadius);
    localBucklingMomentCapacity = elasticBucklingStress * geometry.secondMoment / (section.outerDiameter / 2);
    brazierMomentCapacity = 2 * Math.sqrt(2) * Math.PI / 9 * coupledModulus * meanRadius * maxThickness ** 2 / orthotropicDenominator;
  }
  const properties = {
    outerDiameter: section.outerDiameter,
    thickness: maxThickness,
    ei,
    ea,
    gj,
    shearStiffness,
    linearMass: geometry.mass,
    secondMoment: geometry.secondMoment,
    polarMoment: geometry.polarMoment,
    localBucklingMomentCapacity,
    brazierMomentCapacity,
    bendingMomentCapacity: 0,
    bendingFailurePlyId: "-",
    bendingFailureMode: "なし",
    torqueCapacity: 0,
    compliance,
    cells,
    section,
  } satisfies SectionProperties;
  const bendingFailure = evaluateSectionFailure(properties, 1, 0);
  properties.bendingMomentCapacity = bendingFailure.reserveFactor;
  properties.bendingFailurePlyId = bendingFailure.plyId;
  properties.bendingFailureMode = bendingFailure.mode;
  properties.torqueCapacity = evaluateSectionFailure(properties, 0, 1).reserveFactor;
  return properties;
}

function createResultPoint(base: Omit<StructuralResultPoint, "outerDiameter" | "thickness" | "ei" | "gj" | "linearMass" | "axialStress" | "shearStress" | "bendingMomentCapacity" | "bendingReserveFactor" | "torqueCapacity" | "torsionReserveFactor" | "minReserveFactor" | "criticalPlyId" | "criticalMode">, section: SectionProperties): StructuralResultPoint {
  const plyFailure = evaluateSectionFailure(section, base.bendingMoment, base.torque);
  const bendingReserveFactor = reserveFactor(section.bendingMomentCapacity, base.bendingMoment);
  const torsionReserveFactor = reserveFactor(section.torqueCapacity, base.torque);
  const localBucklingReserveFactor = section.localBucklingMomentCapacity === undefined ? undefined : reserveFactor(section.localBucklingMomentCapacity, base.bendingMoment);
  const brazierReserveFactor = section.brazierMomentCapacity === undefined ? undefined : reserveFactor(section.brazierMomentCapacity, base.bendingMoment);
  let critical = { reserveFactor: plyFailure.reserveFactor, plyId: plyFailure.plyId, mode: plyFailure.mode };
  if (localBucklingReserveFactor !== undefined && localBucklingReserveFactor < critical.reserveFactor) critical = { reserveFactor: localBucklingReserveFactor, plyId: "-", mode: "局部座屈（弾性スクリーニング）" };
  if (brazierReserveFactor !== undefined && brazierReserveFactor < critical.reserveFactor) critical = { reserveFactor: brazierReserveFactor, plyId: "-", mode: "Brazier扁平化（弾性スクリーニング）" };

  return {
    ...base,
    outerDiameter: section.outerDiameter,
    thickness: section.thickness,
    ei: section.ei,
    gj: section.gj,
    linearMass: section.linearMass,
    axialStress: plyFailure.axialStress,
    shearStress: plyFailure.shearStress,
    bendingMomentCapacity: section.bendingMomentCapacity,
    bendingReserveFactor,
    localBucklingReserveFactor,
    brazierReserveFactor,
    torqueCapacity: section.torqueCapacity,
    torsionReserveFactor,
    minReserveFactor: critical.reserveFactor,
    criticalPlyId: critical.plyId,
    criticalMode: critical.mode,
  };
}

function buildCircumferenceCells(section: StructuralTubeSection, materials: ReadonlyMap<string, CarbonMaterial>): CircumferentialCell[] {
  const expanded = section.plies.flatMap((ply) => Array.from({ length: ply.count }, () => ({ ply, material: requireMaterial(materials, ply.materialId) })));
  const maxThickness = expanded.reduce((sum, item) => sum + item.material.plyThickness, 0);
  const innerRadius = section.outerDiameter / 2 - maxThickness;
  if (innerRadius <= 0) throw new Error(`パイプセクション ${section.id} の積層厚さが外径を超えています。`);
  let nominalRadius = innerRadius;
  const instances = expanded.map(({ ply, material }) => {
    const meanRadius = nominalRadius + material.plyThickness / 2;
    nominalRadius += material.plyThickness;
    const halfAngle = (ply.partialAngle ?? 90) >= 90
      ? Math.PI / 2
      : Math.min(Math.PI / 2, ply.partialWidth !== undefined ? ply.partialWidth / (2 * meanRadius) : ply.partialAngle! * Math.PI / 180);
    return { ply, material, q: transformedReducedStiffness(material, ply.angle), halfAngle };
  });
  // Regular sub-intervals keep the trigonometric section integrals at near
  // machine precision; cap edges are inserted as additional exact boundaries.
  const boundaries = Array.from({ length: 5 }, (_, index) => Math.PI * index / 2);
  for (const instance of instances) {
    if (instance.halfAngle >= Math.PI / 2 - 1e-12) continue;
    boundaries.push(
      Math.PI / 2 - instance.halfAngle,
      Math.PI / 2 + instance.halfAngle,
      3 * Math.PI / 2 - instance.halfAngle,
      3 * Math.PI / 2 + instance.halfAngle,
    );
  }
  const sortedBoundaries = [...new Set(boundaries.map((value) => value.toFixed(14)))].map(Number).sort((a, b) => a - b);
  const gaussNodes = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
  const gaussWeights = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
  const integrationPoints = sortedBoundaries.slice(1).flatMap((upper, intervalIndex) => {
    const lower = sortedBoundaries[intervalIndex];
    const midpoint = (lower + upper) / 2;
    const halfWidth = (upper - lower) / 2;
    return gaussNodes.map((node, index) => ({ theta: midpoint + halfWidth * node, dTheta: halfWidth * gaussWeights[index] }));
  });
  // Zero-weight points do not affect stiffness or mass, but ensure that failure is
  // checked at the top/bottom fibres and exactly at every cap termination.
  const evaluationPoints = [...sortedBoundaries, Math.PI / 2, 3 * Math.PI / 2].map((theta) => ({ theta, dTheta: 0 }));
  return [...integrationPoints, ...evaluationPoints].map(({ theta, dTheta }) => {
    let radius = innerRadius;
    const plies: CircumferentialPly[] = [];
    for (const instance of instances) {
      if (!isCoveredByUpperLowerCaps(theta, instance.halfAngle)) continue;
      const outerRadius = radius + instance.material.plyThickness;
      plies.push({ ply: instance.ply, material: instance.material, q: instance.q, innerRadius: radius, outerRadius, meanRadius: (radius + outerRadius) / 2 });
      radius = outerRadius;
    }
    return { theta, dTheta, plies };
  });
}

function isCoveredByUpperLowerCaps(theta: number, halfAngle: number) {
  if (halfAngle >= Math.PI / 2 - 1e-12) return true;
  return Math.abs(Math.sin(theta)) >= Math.cos(halfAngle);
}

function sectorArea(innerRadius: number, outerRadius: number, dTheta: number) {
  return (outerRadius ** 2 - innerRadius ** 2) * dTheta / 2;
}

function sectionStiffness(cells: readonly CircumferentialCell[]): Matrix3 {
  const stiffness = zeroMatrix();
  for (let column = 0; column < 3; column += 1) {
    const generalized = [0, 0, 0] as [number, number, number];
    generalized[column] = 1;
    const force = integrateSectionForces(cells, generalized);
    for (let row = 0; row < 3; row += 1) stiffness[row][column] = force[row];
  }
  for (let row = 0; row < 3; row += 1) for (let column = row + 1; column < 3; column += 1) {
    const symmetric = (stiffness[row][column] + stiffness[column][row]) / 2;
    stiffness[row][column] = symmetric;
    stiffness[column][row] = symmetric;
  }
  return stiffness;
}

function integrateSectionForces(cells: readonly CircumferentialCell[], generalized: readonly [number, number, number]): [number, number, number] {
  const result: [number, number, number] = [0, 0, 0];
  const radialNodes = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
  const radialWeights = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
  for (const cell of cells) {
    for (const ply of cell.plies) {
      const midpoint = (ply.innerRadius + ply.outerRadius) / 2;
      const halfThickness = (ply.outerRadius - ply.innerRadius) / 2;
      for (let index = 0; index < radialNodes.length; index += 1) {
        const radius = midpoint + halfThickness * radialNodes[index];
        const epsilonY = localHoopStrainAtRadius(cell, radius, generalized);
        const state = localPlyStateAtRadius(cell, ply, radius, epsilonY, generalized);
        const area = radius * halfThickness * radialWeights[index] * cell.dTheta;
        const vertical = radius * Math.sin(cell.theta);
        result[0] += state.sigmaX * area;
        result[1] += state.sigmaX * vertical * area;
        result[2] += state.tauXY * radius * area;
      }
    }
  }
  return result;
}

function localHoopStrainAtRadius(cell: CircumferentialCell, radius: number, generalized: readonly [number, number, number]) {
  const [axialStrain, curvature, twistRate] = generalized;
  const epsilonX = axialStrain + curvature * radius * Math.sin(cell.theta);
  const gammaXY = twistRate * radius;
  let hoopNumerator = 0;
  let hoopDenominator = 0;
  for (const ply of cell.plies) {
    const thickness = ply.outerRadius - ply.innerRadius;
    hoopNumerator += thickness * (ply.q[1][0] * epsilonX + ply.q[1][2] * gammaXY);
    hoopDenominator += thickness * ply.q[1][1];
  }
  return -hoopNumerator / hoopDenominator;
}

function localPlyStateAtRadius(cell: CircumferentialCell, ply: CircumferentialPly, radius: number, epsilonY: number, generalized: readonly [number, number, number]) {
  const [axialStrain, curvature, twistRate] = generalized;
  const vertical = radius * Math.sin(cell.theta);
  const strain: [number, number, number] = [axialStrain + curvature * vertical, epsilonY, twistRate * radius];
  const [sigmaX, sigmaY, tauXY] = multiplyMatrixVector(ply.q, strain);
  return { ply, sigmaX, sigmaY, tauXY };
}

function sectionGeneralizedStrain(section: SectionProperties, bendingMoment: number, torque: number) {
  return multiplyMatrixVector(section.compliance, [0, bendingMoment, torque]);
}

function evaluateSectionFailure(section: SectionProperties, bendingMoment: number, torque: number) {
  const generalized = sectionGeneralizedStrain(section, bendingMoment, torque);
  let critical = { reserveFactor: Number.POSITIVE_INFINITY, plyId: "-", mode: "なし" };
  let axialStress = 0;
  let shearStress = 0;
  for (const cell of section.cells) {
    for (const ply of cell.plies) for (const radius of [ply.innerRadius, ply.outerRadius]) {
      const epsilonY = localHoopStrainAtRadius(cell, radius, generalized);
      const state = localPlyStateAtRadius(cell, ply, radius, epsilonY, generalized);
      if (Math.abs(state.sigmaX) > Math.abs(axialStress)) axialStress = state.sigmaX;
      if (Math.abs(state.tauXY) > Math.abs(shearStress)) shearStress = state.tauXY;
      const materialCritical = evaluateHashin(state.sigmaX, state.sigmaY, state.tauXY, state.ply);
      if (materialCritical.reserveFactor < critical.reserveFactor) critical = materialCritical;
    }
  }
  return { ...critical, axialStress, shearStress };
}

function evaluateHashin(sigmaX: number, sigmaY: number, tauXY: number, ply: CircumferentialPly) {
  const angle = ply.ply.angle * Math.PI / 180;
  const m = Math.cos(angle);
  const n = Math.sin(angle);
  const sigma1 = m * m * sigmaX + n * n * sigmaY + 2 * m * n * tauXY;
  const sigma2 = n * n * sigmaX + m * m * sigmaY - 2 * m * n * tauXY;
  const tau12 = -m * n * sigmaX + m * n * sigmaY + (m * m - n * n) * tauXY;
  const material = ply.material;
  const xt = material.tensileStrength1 * material.reductionFactor;
  const xc = material.compressiveStrength1 * material.reductionFactor;
  const yt = material.tensileStrength2 * material.reductionFactor;
  const yc = material.compressiveStrength2 * material.reductionFactor;
  const s = material.shearStrength12 * material.reductionFactor;
  const fiber = {
    reserveFactor: homogeneousReserveFactor(sigma1 >= 0 ? (sigma1 / xt) ** 2 + (tau12 / s) ** 2 : (sigma1 / xc) ** 2),
    plyId: ply.ply.id,
    mode: sigma1 >= 0 ? "繊維引張" : "繊維圧縮",
  };
  const matrix = {
    reserveFactor: sigma2 >= 0
      ? homogeneousReserveFactor((sigma2 / yt) ** 2 + (tau12 / s) ** 2)
      : quadraticReserveFactor((sigma2 / (2 * s)) ** 2 + (tau12 / s) ** 2, ((yc / (2 * s)) ** 2 - 1) * sigma2 / yc),
    plyId: ply.ply.id,
    mode: sigma2 >= 0 ? "母材引張" : "母材圧縮",
  };
  return fiber.reserveFactor < matrix.reserveFactor ? fiber : matrix;
}

function homogeneousReserveFactor(failureIndex: number) {
  return failureIndex < 1e-24 ? Number.POSITIVE_INFINITY : 1 / Math.sqrt(failureIndex);
}

function quadraticReserveFactor(quadratic: number, linear: number) {
  if (quadratic < 1e-24) return linear > 1e-24 ? 1 / linear : Number.POSITIVE_INFINITY;
  return (-linear + Math.sqrt(linear * linear + 4 * quadratic)) / (2 * quadratic);
}

function multiplyMatrixVector(matrix: Matrix3, vector: readonly [number, number, number]): [number, number, number] {
  return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]) as [number, number, number];
}

function reserveFactor(capacity: number, demand: number) {
  return Math.abs(demand) < 1e-12 ? Number.POSITIVE_INFINITY : capacity / Math.abs(demand);
}

function transformedReducedStiffness(material: CarbonMaterial, angle: number): Matrix3 {
  const nu21 = material.nu12 * material.e2 / material.e1;
  const denominator = 1 - material.nu12 * nu21;
  const q11 = material.e1 / denominator;
  const q22 = material.e2 / denominator;
  const q12 = material.nu12 * material.e2 / denominator;
  const q66 = material.g12;
  const radians = angle * Math.PI / 180;
  const m = Math.cos(radians);
  const n = Math.sin(radians);
  const m2 = m * m;
  const n2 = n * n;
  const m4 = m2 * m2;
  const n4 = n2 * n2;
  const q16 = (q11 - q12 - 2 * q66) * m * m2 * n - (q22 - q12 - 2 * q66) * m * n * n2;
  const q26 = (q11 - q12 - 2 * q66) * m * n * n2 - (q22 - q12 - 2 * q66) * m * m2 * n;
  return [
    [q11 * m4 + 2 * (q12 + 2 * q66) * m2 * n2 + q22 * n4, (q11 + q22 - 4 * q66) * m2 * n2 + q12 * (m4 + n4), q16],
    [(q11 + q22 - 4 * q66) * m2 * n2 + q12 * (m4 + n4), q11 * n4 + 2 * (q12 + 2 * q66) * m2 * n2 + q22 * m4, q26],
    [q16, q26, (q11 + q22 - 2 * q12 - 2 * q66) * m2 * n2 + q66 * (m4 + n4)],
  ];
}

function validateInputs(design: StructuralDesign, loadCase: StructuralLoadCase, materials: readonly CarbonMaterial[]) {
  if (!design.sections.length) throw new Error("パイプセクションは1つ以上必要です。");
  const span = design.sections.reduce((sum, section) => sum + section.length, 0);
  const materialIds = new Set(materials.map((material) => material.id));
  const positiveFields: Array<keyof CarbonMaterial> = ["e1", "e2", "g12", "tensileStrength1", "compressiveStrength1", "tensileStrength2", "compressiveStrength2", "shearStrength12", "density", "plyThickness", "reductionFactor"];
  if (materials.some((material) => positiveFields.some((field) => typeof material[field] !== "number" || !Number.isFinite(material[field] as number) || (material[field] as number) <= 0) || material.nu12 < 0 || material.nu12 >= 0.5 || material.reductionFactor > 1)) throw new Error("材料プロパティは正の有限値、ν12は0以上0.5未満、低減係数は1以下で指定してください。");
  if (design.sections.some((section) => section.length <= 0 || section.outerDiameter <= 0 || !section.plies.length || section.plies.some((ply) => ply.count < 1 || !materialIds.has(ply.materialId) || ply.partialAngle !== undefined && (!Number.isFinite(ply.partialAngle) || ply.partialAngle <= 0 || ply.partialAngle > 90) || ply.partialWidth !== undefined && (!Number.isFinite(ply.partialWidth) || ply.partialWidth <= 0)))) throw new Error("パイプセクションの長さ、外径、積層、材料参照を確認してください。");
  if (loadCase.loadFactor <= 0 || loadCase.safetyFactor <= 0) throw new Error("荷重倍数と安全係数は0より大きい必要があります。");
  if ((design.supports ?? []).some((support) => support.yPosition <= 0 || support.yPosition > span || support.kind === "elastic" && (!support.stiffness || support.stiffness <= 0))) throw new Error("支持点は翼内の正の位置に置き、弾性支持には正の剛性を指定してください。");
}

function invert3(matrix: Matrix3): Matrix3 {
  const [a, b, c] = matrix[0];
  const [d, e, f] = matrix[1];
  const [g, h, i] = matrix[2];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(determinant) < 1e-20) throw new Error("積層剛性行列が特異です。");
  return [
    [(e * i - f * h) / determinant, (c * h - b * i) / determinant, (b * f - c * e) / determinant],
    [(f * g - d * i) / determinant, (a * i - c * g) / determinant, (c * d - a * f) / determinant],
    [(d * h - e * g) / determinant, (b * g - a * h) / determinant, (a * e - b * d) / determinant],
  ];
}

function zeroMatrix(): Matrix3 { return [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; }
function addScaled(target: Matrix3, source: Matrix3, scale: number) { for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) target[row][column] += source[row][column] * scale; }
function requireMaterial(materials: ReadonlyMap<string, CarbonMaterial>, id: string) { const material = materials.get(id); if (!material) throw new Error(`材料 ${id} が見つかりません。`); return material; }
function interpolate(start: number, end: number, ratio: number) { return start + (end - start) * ratio; }
function interpolateLoad(loadCase: StructuralLoadCase, y: number, field: "liftPerLength" | "torquePerLength") { const loads = [...loadCase.distributedLoads].sort((a, b) => a.yPosition - b.yPosition); if (!loads.length) return 0; if (y <= loads[0].yPosition) return loads[0][field]; if (y >= loads.at(-1)!.yPosition) return loads.at(-1)![field]; const upperIndex = loads.findIndex((load) => load.yPosition >= y); const lower = loads[upperIndex - 1]; const upper = loads[upperIndex]; return interpolate(lower[field], upper[field], (y - lower.yPosition) / (upper.yPosition - lower.yPosition)); }
function integrateForward(x: readonly number[], values: readonly number[]) { const result = new Array<number>(x.length).fill(0); for (let index = 1; index < x.length; index += 1) result[index] = result[index - 1] + (values[index - 1] + values[index]) * (x[index] - x[index - 1]) / 2; return result; }
function momentFromPoints(y: readonly number[], distributedMoment: readonly number[], loads: readonly { yPosition: number; force: number }[]) { return y.map((position, index) => distributedMoment[index] + loads.reduce((sum, load) => sum + load.force * Math.max(0, load.yPosition - position), 0)); }
function deflectionFromForces(y: readonly number[], moment: readonly number[], shear: readonly number[], torque: readonly number[], sections: readonly SectionProperties[]) {
  const curvature = sections.map((section, index) => sectionGeneralizedStrain(section, moment[index], torque[index])[1]);
  const rotation = integrateForward(y, curvature);
  return integrateForward(y, rotation.map((value, index) => value + shear[index] / sections[index].shearStiffness));
}
function solveSupportReactions(supports: NonNullable<StructuralDesign["supports"]>, y: readonly number[], sections: readonly SectionProperties[], baseDeflection: readonly number[]) {
  const matrix = supports.map((support, row) => supports.map((unitSupport, column) => {
    const unitShear = y.map((position) => position <= unitSupport.yPosition + 1e-10 ? 1 : 0);
    const unitMoment = y.map((position) => Math.max(0, unitSupport.yPosition - position));
    const unitTorque = y.map(() => 0);
    const influence = interpolateSeries(y, deflectionFromForces(y, unitMoment, unitShear, unitTorque, sections), support.yPosition);
    return influence + (row === column && support.kind === "elastic" ? 1 / support.stiffness! : 0);
  }));
  const rhs = supports.map((support) => -interpolateSeries(y, baseDeflection, support.yPosition));
  const reactions = solveLinearSystem(matrix, rhs);
  return supports.map((support, index) => ({ supportId: support.id, yPosition: support.yPosition, force: reactions[index] }));
}
function interpolateSeries(x: readonly number[], values: readonly number[], position: number) { if (position <= x[0]) return values[0]; if (position >= x.at(-1)!) return values.at(-1)!; const upperIndex = x.findIndex((value) => value >= position); const ratio = (position - x[upperIndex - 1]) / (x[upperIndex] - x[upperIndex - 1]); return interpolate(values[upperIndex - 1], values[upperIndex], ratio); }
function solveLinearSystem(matrix: readonly (readonly number[])[], rhs: readonly number[]) { const augmented = matrix.map((row, index) => [...row, rhs[index]]); for (let column = 0; column < augmented.length; column += 1) { let pivot = column; for (let row = column + 1; row < augmented.length; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row; [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]; if (Math.abs(augmented[column][column]) < 1e-20) throw new Error("支持条件の剛性行列が特異です。"); const scale = augmented[column][column]; for (let item = column; item <= augmented.length; item += 1) augmented[column][item] /= scale; for (let row = 0; row < augmented.length; row += 1) { if (row === column) continue; const factor = augmented[row][column]; for (let item = column; item <= augmented.length; item += 1) augmented[row][item] -= factor * augmented[column][item]; } } return augmented.map((row) => row.at(-1)!); }
function trapezoid(x: readonly number[], values: readonly number[]) { let total = 0; for (let index = 1; index < x.length; index += 1) total += (values[index - 1] + values[index]) * (x[index] - x[index - 1]) / 2; return total; }
function cloneLoadCase(loadCase: StructuralLoadCase): StructuralLoadCase { return { ...loadCase, distributedLoads: loadCase.distributedLoads.map((load) => ({ ...load })), pointLoads: loadCase.pointLoads.map((load) => ({ ...load })) }; }
function cloneDesign(design: StructuralDesign): StructuralDesign { return { ...design, sections: design.sections.map((section) => ({ ...section, plies: section.plies.map((ply) => ({ ...ply })) })), loadCases: design.loadCases.map(cloneLoadCase), supports: design.supports?.map((support) => ({ ...support })) }; }
