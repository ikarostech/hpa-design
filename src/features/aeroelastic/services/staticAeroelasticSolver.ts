import type { AircraftGeometry } from "../../aircraft/model/types";
import { calculateVlmCoefficients } from "../../analysis/services/vlmSolver";
import { createWingAnalysisMesh, type WingAnalysisMesh } from "../../analysis/services/wingAnalysisMesh";
import type { CarbonMaterial, StructuralAnalysisResult, StructuralDesign, StructuralLoadCase } from "../../structures/model/types";
import { executeStructuralAnalysis } from "../../structures/services/structuralAnalysis";
import type { AirfoilPolar } from "../../airfoils/model/types";
import type {
  AerodynamicSpanLoadPoint,
  AeroelasticCondition,
  AeroelasticConvergenceStatus,
  AeroelasticIteration,
  BeamDeformationPoint,
  StaticAeroelasticSettings,
} from "../model/types";
import { transferVlmLoadsToBeam } from "./aerodynamicLoadTransfer";
import { deformWingAnalysisMesh } from "./aerodynamicMeshDeformation";
import { solveLiftTrim } from "./liftTrimSolver";

export interface StaticAeroelasticResult {
  id: string;
  createdAt: string;
  status: AeroelasticConvergenceStatus;
  reviewStatus: "current" | "needs-review";
  aircraftSnapshot: AircraftGeometry;
  structuralDesignId: string;
  materialIds: string[];
  condition: AeroelasticCondition;
  settings: StaticAeroelasticSettings;
  density: number;
  speed: number;
  elasticAxisChordFraction: number;
  alphaDegrees: number;
  cl: number;
  cdi: number;
  cm: number;
  totalLift: number;
  spanLoads: AerodynamicSpanLoadPoint[];
  structuralResult: StructuralAnalysisResult;
  undeformedMesh: WingAnalysisMesh;
  deformedMesh: WingAnalysisMesh;
  iterations: AeroelasticIteration[];
  warnings: string[];
}

export interface StaticAeroelasticProgress {
  completed: number;
  total: number;
  message: string;
}

const defaultSettings: StaticAeroelasticSettings = {
  maxIterations: 50,
  relaxationFactor: 0.3,
  displacementTolerance: 1e-5,
  loadTolerance: 1e-5,
  liftTolerance: 1e-4,
};

export function executeStaticAeroelasticAnalysis({
  resultId,
  aircraft,
  structuralDesign,
  materials,
  density,
  speed,
  elasticAxisChordFraction,
  condition,
  polars = [],
  settings: settingOverrides = {},
  onProgress = () => undefined,
}: {
  resultId: string;
  aircraft: AircraftGeometry;
  structuralDesign: StructuralDesign;
  materials: readonly CarbonMaterial[];
  density: number;
  speed: number;
  elasticAxisChordFraction: number;
  condition: AeroelasticCondition;
  polars?: readonly AirfoilPolar[];
  settings?: Partial<StaticAeroelasticSettings>;
  onProgress?: (progress: StaticAeroelasticProgress) => void;
}): StaticAeroelasticResult {
  const settings = { ...defaultSettings, ...settingOverrides };
  validateInputs(aircraft, structuralDesign, density, speed, elasticAxisChordFraction, settings);
  const undeformedMesh = createWingAnalysisMesh(aircraft.sections);
  if (!undeformedMesh.panels.length) throw new Error("空力構造連成には主翼パネルが必要です。");
  const semiSpan = aircraft.span / 2;
  let deformation: BeamDeformationPoint[] = [
    { yPosition: 0, deflection: 0, rotation: 0, twist: 0 },
    { yPosition: semiSpan, deflection: 0, rotation: 0, twist: 0 },
  ];
  let previousLoads: AerodynamicSpanLoadPoint[] | null = null;
  let finalMesh = undeformedMesh;
  let finalStructural: StructuralAnalysisResult | null = null;
  let finalLoads: AerodynamicSpanLoadPoint[] = [];
  let finalAerodynamic = calculateVlmCoefficients(aircraft, undeformedMesh, fixedAlphaOrZero(condition));
  let finalAlpha = fixedAlphaOrZero(condition);
  let finalLift = 0;
  let status: AeroelasticConvergenceStatus = "max-iterations";
  const iterations: AeroelasticIteration[] = [];
  let increasingResidualCount = 0;

  for (let iteration = 1; iteration <= settings.maxIterations; iteration += 1) {
    const mesh = deformWingAnalysisMesh(undeformedMesh, deformation, elasticAxisChordFraction);
    const aerodynamicState = evaluateAerodynamics({ aircraft, mesh, density, speed, condition, liftTolerance: settings.liftTolerance });
    const transferred = transferVlmLoadsToBeam({
      aircraft,
      mesh,
      panelLoads: aerodynamicState.coefficients.panelLoads,
      density,
      speed,
      elasticAxisChordFraction,
      sectionMomentCoefficients: calculateSectionMomentCoefficients(mesh, polars, aerodynamicState.alphaDegrees + aircraft.incidence),
    });
    const loadCase = createCoupledLoadCase(resultId, transferred.points);
    const structural = executeStructuralAnalysis({
      design: structuralDesign,
      loadCase,
      materials,
      resultId: `${resultId}-structure-${iteration}`,
      sampleCount: Math.max(41, undeformedMesh.strips.length * 4 + 1),
    });
    const rawDeformation = structural.points.map(({ yPosition, deflection, rotation, twist }) => ({ yPosition, deflection, rotation, twist }));
    const nextDeformation = relaxDeformation(deformation, rawDeformation, settings.relaxationFactor);
    const displacementResidual = deformationResidual(deformation, nextDeformation);
    const loadResidual = previousLoads ? spanLoadResidual(previousLoads, transferred.points) : null;
    const liftResidual = condition.mode === "target-lift"
      ? Math.abs(aerodynamicState.totalLift - condition.targetLift) / condition.targetLift
      : 0;
    const history: AeroelasticIteration = {
      iteration,
      alphaDegrees: aerodynamicState.alphaDegrees,
      cl: aerodynamicState.coefficients.cl,
      cdi: aerodynamicState.coefficients.cdi,
      totalLift: aerodynamicState.totalLift,
      maxDeflection: structural.summary.maxDeflection,
      maxTwist: structural.summary.maxTwist,
      displacementResidual,
      loadResidual,
      liftResidual,
    };
    iterations.push(history);
    onProgress({ completed: iteration, total: settings.maxIterations, message: `連成反復 ${iteration}/${settings.maxIterations}` });

    if (!finiteIteration(history) || transferred.points.some((point) => !finiteSpanLoad(point))) {
      status = "diverged";
      finalMesh = mesh;
      finalStructural = structural;
      finalLoads = transferred.points;
      finalAerodynamic = aerodynamicState.coefficients;
      finalAlpha = aerodynamicState.alphaDegrees;
      finalLift = aerodynamicState.totalLift;
      break;
    }
    if (iteration > 2 && displacementResidual > iterations[iteration - 2].displacementResidual) increasingResidualCount += 1;
    else increasingResidualCount = 0;
    if (increasingResidualCount >= 5) status = "diverged";

    deformation = nextDeformation;
    previousLoads = transferred.points;
    finalMesh = deformWingAnalysisMesh(undeformedMesh, deformation, elasticAxisChordFraction);
    finalStructural = structural;
    finalLoads = transferred.points;
    finalAerodynamic = aerodynamicState.coefficients;
    finalAlpha = aerodynamicState.alphaDegrees;
    finalLift = aerodynamicState.totalLift;

    if (loadResidual !== null
      && displacementResidual <= settings.displacementTolerance
      && loadResidual <= settings.loadTolerance
      && liftResidual <= settings.liftTolerance) {
      status = "converged";
      break;
    }
    if (status === "diverged") break;
  }

  if (!finalStructural) throw new Error("空力構造連成解析を実行できませんでした。");
  return {
    id: resultId,
    createdAt: new Date().toISOString(),
    status,
    reviewStatus: "current",
    aircraftSnapshot: { ...aircraft, sections: aircraft.sections.map((section) => ({ ...section })) },
    structuralDesignId: structuralDesign.id,
    materialIds: Array.from(new Set(structuralDesign.sections.flatMap((section) => section.plies.map((ply) => ply.materialId)))),
    condition,
    settings,
    density,
    speed,
    elasticAxisChordFraction,
    alphaDegrees: finalAlpha,
    cl: finalAerodynamic.cl,
    cdi: finalAerodynamic.cdi,
    cm: finalAerodynamic.cm,
    totalLift: finalLift,
    spanLoads: finalLoads,
    structuralResult: finalStructural,
    undeformedMesh,
    deformedMesh: finalMesh,
    iterations,
    warnings: applicabilityWarnings(finalStructural, semiSpan),
  };
}

function evaluateAerodynamics({
  aircraft,
  mesh,
  density,
  speed,
  condition,
  liftTolerance,
}: {
  aircraft: AircraftGeometry;
  mesh: WingAnalysisMesh;
  density: number;
  speed: number;
  condition: AeroelasticCondition;
  liftTolerance: number;
}) {
  const forceScale = density * speed ** 2 * aircraft.wingArea / 2;
  if (condition.mode === "fixed-alpha") {
    const coefficients = calculateVlmCoefficients(aircraft, mesh, condition.alphaDegrees);
    return { alphaDegrees: condition.alphaDegrees, coefficients, totalLift: forceScale * coefficients.cl };
  }
  const trim = solveLiftTrim({
    targetLift: condition.targetLift,
    minimumAlpha: condition.minimumAlpha,
    maximumAlpha: condition.maximumAlpha,
    relativeTolerance: liftTolerance,
    evaluateLift: (alpha) => forceScale * calculateVlmCoefficients(aircraft, mesh, alpha).cl,
  });
  const coefficients = calculateVlmCoefficients(aircraft, mesh, trim.alphaDegrees);
  return { alphaDegrees: trim.alphaDegrees, coefficients, totalLift: forceScale * coefficients.cl };
}

function createCoupledLoadCase(resultId: string, loads: readonly AerodynamicSpanLoadPoint[]): StructuralLoadCase {
  return {
    id: `${resultId}-load`,
    name: "空力構造連成荷重",
    source: "aerodynamic",
    aerodynamicResultId: resultId,
    loadFactor: 1,
    safetyFactor: 1,
    distributedLoads: loads.map((load) => ({
      yPosition: load.yPosition,
      liftPerLength: load.liftPerLength,
      torquePerLength: load.torquePerLength,
    })),
    pointLoads: [],
    status: "not-run",
  };
}

function relaxDeformation(
  previous: readonly BeamDeformationPoint[],
  current: readonly BeamDeformationPoint[],
  relaxationFactor: number,
) {
  return current.map((point) => {
    const old = interpolateDeformation(previous, point.yPosition);
    return {
      yPosition: point.yPosition,
      deflection: interpolate(old.deflection, point.deflection, relaxationFactor),
      rotation: interpolate(old.rotation, point.rotation, relaxationFactor),
      twist: interpolate(old.twist, point.twist, relaxationFactor),
    };
  });
}

function deformationResidual(previous: readonly BeamDeformationPoint[], current: readonly BeamDeformationPoint[]) {
  const previousAtCurrent = current.map((point) => interpolateDeformation(previous, point.yPosition));
  return Math.max(
    relativeChange(previousAtCurrent.map((point) => point.deflection), current.map((point) => point.deflection)),
    relativeChange(previousAtCurrent.map((point) => point.rotation), current.map((point) => point.rotation)),
    relativeChange(previousAtCurrent.map((point) => point.twist), current.map((point) => point.twist)),
  );
}

function spanLoadResidual(previous: readonly AerodynamicSpanLoadPoint[], current: readonly AerodynamicSpanLoadPoint[]) {
  return Math.max(
    relativeChange(previous.map((point) => point.liftPerLength), current.map((point) => point.liftPerLength)),
    relativeChange(previous.map((point) => point.torquePerLength), current.map((point) => point.torquePerLength)),
  );
}

function relativeChange(previous: readonly number[], current: readonly number[]) {
  const difference = Math.max(0, ...current.map((value, index) => Math.abs(value - (previous[index] ?? 0))));
  const scale = Math.max(1e-12, ...current.map(Math.abs));
  return difference / scale;
}

function interpolateDeformation(points: readonly BeamDeformationPoint[], yPosition: number) {
  const sorted = [...points].sort((left, right) => left.yPosition - right.yPosition);
  if (yPosition <= sorted[0].yPosition) return sorted[0];
  if (yPosition >= sorted.at(-1)!.yPosition) return sorted.at(-1)!;
  const upperIndex = sorted.findIndex((point) => point.yPosition >= yPosition);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  const ratio = (yPosition - lower.yPosition) / (upper.yPosition - lower.yPosition);
  return {
    yPosition,
    deflection: interpolate(lower.deflection, upper.deflection, ratio),
    rotation: interpolate(lower.rotation, upper.rotation, ratio),
    twist: interpolate(lower.twist, upper.twist, ratio),
  };
}

function applicabilityWarnings(result: StructuralAnalysisResult, semiSpan: number) {
  const warnings: string[] = [];
  if (result.summary.maxDeflection / Math.max(semiSpan, 1e-12) > 0.1) warnings.push("翼端たわみが半翼長の10%を超えており、線形梁の適用範囲を外れる可能性があります。");
  if (result.summary.maxTwist > 0.2 * 180 / Math.PI) warnings.push("弾性ねじれが約11.46°を超えており、幾何学的非線形解析が必要です。");
  return warnings;
}

function finiteIteration(iteration: AeroelasticIteration) {
  return [iteration.alphaDegrees, iteration.cl, iteration.cdi, iteration.totalLift, iteration.maxDeflection, iteration.maxTwist, iteration.displacementResidual, iteration.liftResidual]
    .every(Number.isFinite) && (iteration.loadResidual === null || Number.isFinite(iteration.loadResidual));
}

function finiteSpanLoad(point: AerodynamicSpanLoadPoint) {
  return Object.values(point).every(Number.isFinite);
}

function fixedAlphaOrZero(condition: AeroelasticCondition) {
  return condition.mode === "fixed-alpha" ? condition.alphaDegrees : 0;
}

function calculateSectionMomentCoefficients(mesh: WingAnalysisMesh, polars: readonly AirfoilPolar[], alphaDegrees: number) {
  const byAirfoil = new Map<string, AirfoilPolar>();
  for (const polar of polars) {
    if (polar.status === "complete" && polar.points.length && !byAirfoil.has(polar.airfoilId)) byAirfoil.set(polar.airfoilId, polar);
  }
  return mesh.strips.map((strip) => {
    const localAlpha = alphaDegrees + strip.twist;
    const root = momentAtAlpha(byAirfoil.get(strip.airfoilRootId), localAlpha);
    const tip = momentAtAlpha(byAirfoil.get(strip.airfoilTipId), localAlpha);
    return interpolate(root, tip, strip.airfoilInterpolation);
  });
}

function momentAtAlpha(polar: AirfoilPolar | undefined, alphaDegrees: number) {
  if (!polar?.points.length) return 0;
  const points = [...polar.points].sort((left, right) => left.alpha - right.alpha);
  if (alphaDegrees <= points[0].alpha) return points[0].cm;
  if (alphaDegrees >= points.at(-1)!.alpha) return points.at(-1)!.cm;
  const upperIndex = points.findIndex((point) => point.alpha >= alphaDegrees);
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  return interpolate(lower.cm, upper.cm, (alphaDegrees - lower.alpha) / (upper.alpha - lower.alpha));
}

function validateInputs(
  aircraft: AircraftGeometry,
  design: StructuralDesign,
  density: number,
  speed: number,
  elasticAxisChordFraction: number,
  settings: StaticAeroelasticSettings,
) {
  if (!(density > 0) || !(speed > 0)) throw new Error("空気密度と速度は正で指定してください。");
  if (elasticAxisChordFraction < 0 || elasticAxisChordFraction > 1) throw new Error("弾性軸位置は0から1の範囲で指定してください。");
  const structuralSpan = design.sections.reduce((sum, section) => sum + section.length, 0);
  if (Math.abs(structuralSpan - aircraft.span / 2) > Math.max(1e-6, aircraft.span * 1e-4)) throw new Error("構造設計の長さを主翼半幅に一致させてください。");
  if (settings.maxIterations < 2 || settings.relaxationFactor <= 0 || settings.relaxationFactor > 1
    || settings.displacementTolerance <= 0 || settings.loadTolerance <= 0 || settings.liftTolerance <= 0) {
    throw new Error("連成ソルバー設定が不正です。");
  }
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}
