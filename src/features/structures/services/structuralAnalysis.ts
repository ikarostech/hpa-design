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
    effectiveGxy: 1 / (compliance[2][2] * thickness),
    arealMass,
  };
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
  const sections = y.map((position) => sectionAt(tubeSections, position, materialMap));

  for (let index = count - 2; index >= 0; index -= 1) {
    const dx = y[index + 1] - y[index];
    distributedShear[index] = distributedShear[index + 1] + (q[index] + q[index + 1]) * dx / 2;
    distributedTorqueResult[index] = distributedTorqueResult[index + 1] + (distributedTorque[index] + distributedTorque[index + 1]) * dx / 2;
    distributedMoment[index] = distributedMoment[index + 1] + (distributedShear[index] + distributedShear[index + 1]) * dx / 2;
  }
  const baseMoment = momentFromPoints(y, distributedMoment, pointLoads);
  const baseDeflection = deflectionFromMoment(y, baseMoment, sections);
  const supports = design.supports ?? [];
  const supportReactions = supports.length ? solveSupportReactions(supports, y, sections, baseDeflection) : [];
  const effectivePointLoads = [...pointLoads, ...supportReactions.map((reaction) => ({ id: reaction.supportId, yPosition: reaction.yPosition, force: reaction.force, torque: 0 }))];
  const shear = y.map((position, index) => distributedShear[index] + effectivePointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.force, 0));
  const moment = momentFromPoints(y, distributedMoment, effectivePointLoads);
  const torque = y.map((position, index) => distributedTorqueResult[index] + effectivePointLoads.filter((load) => load.yPosition >= position - 1e-10).reduce((sum, load) => sum + load.torque, 0));
  const curvature = sections.map((section, index) => moment[index] / section.ei);
  const twistRate = sections.map((section, index) => torque[index] / section.gj);
  const rotation = integrateForward(y, curvature);
  const deflection = integrateForward(y, rotation);
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
  }, sections[index], materialMap));
  const governing = points.reduce((current, point) => point.minReserveFactor < current.minReserveFactor ? point : current, points[0]);
  const mass = tubeSections.reduce((sum, section) => sum + tubeSectionProperties(section, materialMap).linearMass * section.length, 0);
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
    },
  };
}

interface SectionProperties {
  outerDiameter: number;
  thickness: number;
  ei: number;
  ea: number;
  gj: number;
  linearMass: number;
  secondMoment: number;
  polarMoment: number;
  section: StructuralTubeSection;
}

function sectionAt(sections: readonly StructuralTubeSection[], y: number, materials: ReadonlyMap<string, CarbonMaterial>): SectionProperties {
  let endPosition = 0;
  for (let index = 0; index < sections.length; index += 1) {
    endPosition += sections[index].length;
    if (y < endPosition - 1e-10 || index === sections.length - 1) return tubeSectionProperties(sections[index], materials);
  }
  return tubeSectionProperties(sections.at(-1)!, materials);
}

function tubeSectionProperties(section: StructuralTubeSection, materials: ReadonlyMap<string, CarbonMaterial>): SectionProperties {
  const laminate = calculateLaminate(section.plies, materials);
  const innerDiameter = section.outerDiameter - 2 * laminate.thickness;
  if (innerDiameter <= 0) throw new Error(`パイプセクション ${section.id} の積層厚さが外径を超えています。`);
  const secondMoment = Math.PI * (section.outerDiameter ** 4 - innerDiameter ** 4) / 64;
  const area = Math.PI * (section.outerDiameter ** 2 - innerDiameter ** 2) / 4;
  const polarMoment = secondMoment * 2;
  const meanCircumference = Math.PI * (section.outerDiameter - laminate.thickness);
  return {
    outerDiameter: section.outerDiameter,
    thickness: laminate.thickness,
    ei: laminate.effectiveEx * secondMoment,
    ea: laminate.effectiveEx * area,
    gj: laminate.effectiveGxy * polarMoment,
    linearMass: laminate.arealMass * meanCircumference,
    secondMoment,
    polarMoment,
    section,
  };
}

function createResultPoint(base: Omit<StructuralResultPoint, "outerDiameter" | "thickness" | "ei" | "gj" | "linearMass" | "axialStress" | "shearStress" | "bendingMomentCapacity" | "bendingReserveFactor" | "torqueCapacity" | "torsionReserveFactor" | "minReserveFactor" | "criticalPlyId" | "criticalMode">, section: SectionProperties, materials: ReadonlyMap<string, CarbonMaterial>): StructuralResultPoint {
  const radius = section.outerDiameter / 2;
  const axialStress = base.bendingMoment * radius / section.secondMoment;
  const shearStress = base.torque * radius / section.polarMoment;
  const critical = evaluateFailure(axialStress, shearStress, section, materials);
  const axialStressCapacity = Math.min(
    evaluateFailure(1, 0, section, materials).reserveFactor,
    evaluateFailure(-1, 0, section, materials).reserveFactor,
  );
  const shearStressCapacity = Math.min(
    evaluateFailure(0, 1, section, materials).reserveFactor,
    evaluateFailure(0, -1, section, materials).reserveFactor,
  );
  const bendingMomentCapacity = axialStressCapacity * section.secondMoment / radius;
  const torqueCapacity = shearStressCapacity * section.polarMoment / radius;

  return {
    ...base,
    outerDiameter: section.outerDiameter,
    thickness: section.thickness,
    ei: section.ei,
    gj: section.gj,
    linearMass: section.linearMass,
    axialStress,
    shearStress,
    bendingMomentCapacity,
    bendingReserveFactor: reserveFactor(bendingMomentCapacity, base.bendingMoment),
    torqueCapacity,
    torsionReserveFactor: reserveFactor(torqueCapacity, base.torque),
    minReserveFactor: critical.reserveFactor,
    criticalPlyId: critical.plyId,
    criticalMode: critical.mode,
  };
}

function evaluateFailure(axialStress: number, shearStress: number, section: SectionProperties, materials: ReadonlyMap<string, CarbonMaterial>) {
  let critical = { reserveFactor: Number.POSITIVE_INFINITY, plyId: "-", mode: "なし" };

  for (const ply of section.section.plies) {
    const material = requireMaterial(materials, ply.materialId);
    const angle = ply.angle * Math.PI / 180;
    const m = Math.cos(angle);
    const n = Math.sin(angle);
    const sigma1 = m * m * axialStress + 2 * m * n * shearStress;
    const sigma2 = n * n * axialStress - 2 * m * n * shearStress;
    const tau12 = -m * n * axialStress + (m * m - n * n) * shearStress;
    const candidates = [
      { value: sigma1, allowed: (sigma1 >= 0 ? material.tensileStrength1 : material.compressiveStrength1) * material.reductionFactor, mode: sigma1 >= 0 ? "繊維引張" : "繊維圧縮" },
      { value: sigma2, allowed: (sigma2 >= 0 ? material.tensileStrength2 : material.compressiveStrength2) * material.reductionFactor, mode: sigma2 >= 0 ? "横方向引張" : "横方向圧縮" },
      { value: tau12, allowed: material.shearStrength12 * material.reductionFactor, mode: "せん断" },
    ];
    for (const candidate of candidates) {
      const reserveFactor = Math.abs(candidate.value) < 1e-12 ? Number.POSITIVE_INFINITY : candidate.allowed / Math.abs(candidate.value);
      if (reserveFactor < critical.reserveFactor) critical = { reserveFactor, plyId: ply.id, mode: candidate.mode };
    }
  }

  return critical;
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
  if (design.sections.some((section) => section.length <= 0 || section.outerDiameter <= 0 || !section.plies.length || section.plies.some((ply) => ply.count < 1 || !materialIds.has(ply.materialId)))) throw new Error("パイプセクションの長さ、外径、積層、材料参照を確認してください。");
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
function deflectionFromMoment(y: readonly number[], moment: readonly number[], sections: readonly SectionProperties[]) { const curvature = sections.map((section, index) => moment[index] / section.ei); return integrateForward(y, integrateForward(y, curvature)); }
function solveSupportReactions(supports: NonNullable<StructuralDesign["supports"]>, y: readonly number[], sections: readonly SectionProperties[], baseDeflection: readonly number[]) {
  const matrix = supports.map((support, row) => supports.map((unitSupport, column) => {
    const unitMoment = y.map((position) => Math.max(0, unitSupport.yPosition - position));
    const influence = interpolateSeries(y, deflectionFromMoment(y, unitMoment, sections), support.yPosition);
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
