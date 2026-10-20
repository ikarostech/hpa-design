import { deriveTailGeometry } from "../../aircraft/model/tailGeometry";
import type { TailSurface } from "../../aircraft/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import { createTailAnalysisMesh, type AircraftMeshPanel } from "./aircraftAnalysisMesh";
import { calculateAircraftVlmCoefficients } from "./vlmSolver";
import { panelFractions } from "./wingAnalysisMesh";

export interface TailAnalysisCondition {
  speed: number;
  density: number;
  dynamicViscosity: number;
  alpha: number;
  beta: number;
}

export interface TailStripLoad {
  side: "left" | "right";
  stripIndex: number;
  spanPosition: number;
  lift: number;
  sideForce: number;
}

interface TailInviscidLoads {
  condition: TailAnalysisCondition;
  reference: { area: number; span: number; chord: number };
  reynoldsRange: [number, number];
  cl: number;
  cy: number;
  cdi: number;
  lift: number;
  sideForce: number;
  inducedDrag: number;
  strips: TailStripLoad[];
}

export type TailAnalysisResult = {
  status: "unsupported";
  issues: string[];
} | (TailInviscidLoads & {
  status: "inviscid-only";
  issues: string[];
  polarIds: [];
  profileCd: null;
  cd: null;
  cm: null;
  drag: null;
}) | (TailInviscidLoads & {
  status: "valid";
  issues: [];
  polarIds: string[];
  profileCd: number;
  cd: number;
  cm: number;
  drag: number;
});

/** Single-surface, inviscid VLM loads plus Polar profile Cd/Cm. No trim or stability verdict. */
export function analyzeTailSurface(surface: TailSurface, condition: TailAnalysisCondition, polars: readonly AirfoilPolar[]): TailAnalysisResult {
  const issues: string[] = [];
  if (!Number.isFinite(condition.speed) || condition.speed <= 0) issues.push("Speed must be positive.");
  if (!Number.isFinite(condition.density) || condition.density <= 0) issues.push("Air density must be positive.");
  if (!Number.isFinite(condition.dynamicViscosity) || condition.dynamicViscosity <= 0) issues.push("Dynamic viscosity must be positive.");
  if (![condition.alpha, condition.beta].every(Number.isFinite)) issues.push("Angles must be finite.");
  if (issues.length) return { status: "unsupported", issues };

  let mesh: ReturnType<typeof createTailAnalysisMesh>;
  try { mesh = createTailAnalysisMesh(surface); }
  catch (error) { return { status: "unsupported", issues: [error instanceof Error ? error.message : String(error)] }; }
  const metrics = deriveTailGeometry(surface);
  const referenceArea = metrics.area;
  if (metrics.area <= 0 || metrics.span <= 0 || metrics.meanAerodynamicChord <= 0) {
    return { status: "unsupported", issues: ["Tail reference dimensions must be positive."] };
  }

  const usedPolarIds = new Set<string>();
  const reynolds: number[] = [];
  let profileDragNumerator = 0;
  let profileMomentNumerator = 0;
  for (const panel of mesh.panels) {
    const chord = localChord(surface, panel.stripIndex);
    const localRe = condition.density * condition.speed * chord / condition.dynamicViscosity;
    const localAngle = (surface.orientation === "horizontal" ? condition.alpha : condition.beta)
      + surface.incidence + localTwist(surface, panel.stripIndex);
    reynolds.push(localRe);
    const root = samplePolar(panel.airfoilRootId, localRe, localAngle, polars, usedPolarIds);
    const tip = samplePolar(panel.airfoilTipId, localRe, localAngle, polars, usedPolarIds);
    if (typeof root === "string") issues.push(root);
    if (typeof tip === "string") issues.push(tip);
    if (typeof root !== "string" && typeof tip !== "string") {
      const area = panelArea(panel);
      profileDragNumerator += area * (root.cd + tip.cd) / 2;
      profileMomentNumerator += area * chord * (root.cm + tip.cm) / 2;
    }
  }
  let vlm: ReturnType<typeof calculateAircraftVlmCoefficients>;
  try {
    vlm = calculateAircraftVlmCoefficients(mesh, {
      alpha: condition.alpha, beta: condition.beta,
      reference: { area: referenceArea, span: metrics.span, chord: metrics.meanAerodynamicChord,
        point: metrics.aerodynamicCenter },
    });
  } catch (error) {
    return { status: "unsupported", issues: [error instanceof Error ? error.message : String(error)] };
  }
  const dynamicPressure = condition.density * condition.speed ** 2 / 2;
  const strips = new Map<string, TailStripLoad>();
  for (const [index, load] of vlm.panelLoads.entries()) {
    const panel = mesh.panels[index];
    const key = `${load.side}:${load.stripIndex}`;
    const current = strips.get(key) ?? {
      side: load.side, stripIndex: load.stripIndex, spanPosition: panelSpanPosition(surface, panel), lift: 0, sideForce: 0,
    };
    current.lift += dynamicPressure * (-Math.sin(condition.alpha * Math.PI / 180) * load.force.x + Math.cos(condition.alpha * Math.PI / 180) * load.force.z);
    current.sideForce += dynamicPressure * load.force.y;
    strips.set(key, current);
  }
  const inviscid: TailInviscidLoads = {
    condition: { ...condition },
    reference: { area: referenceArea, span: metrics.span, chord: metrics.meanAerodynamicChord },
    reynoldsRange: [Math.min(...reynolds), Math.max(...reynolds)],
    cl: vlm.cl, cy: vlm.cy, cdi: vlm.cdi,
    lift: dynamicPressure * referenceArea * vlm.cl,
    sideForce: dynamicPressure * vlm.force.y,
    inducedDrag: dynamicPressure * referenceArea * vlm.cdi,
    strips: [...strips.values()],
  };
  if (issues.length) return {
    ...inviscid, status: "inviscid-only", issues: [...new Set(issues)],
    polarIds: [], profileCd: null, cd: null, cm: null, drag: null,
  };
  const profileCd = profileDragNumerator / referenceArea;
  return {
    ...inviscid, status: "valid", issues: [], polarIds: [...usedPolarIds], profileCd,
    cd: vlm.cdi + profileCd,
    cm: vlm.cm + (surface.orientation === "horizontal" ? profileMomentNumerator / (referenceArea * metrics.meanAerodynamicChord) : 0),
    drag: dynamicPressure * referenceArea * (vlm.cdi + profileCd),
  };
}

function samplePolar(airfoilId: string, reynolds: number, angle: number, polars: readonly AirfoilPolar[], used: Set<string>): { cd: number; cm: number } | string {
  const matching = polars.filter((polar) => polar.airfoilId === airfoilId);
  if (!matching.length) return `翼型 ${airfoilId} のPolarがありません。翼型タブでPolar解析を実行してください。`;
  const candidates = polars.filter((polar) => polar.airfoilId === airfoilId && polar.status === "complete"
    && Number.isFinite(polar.reynolds) && polar.reynolds > 0 && polar.points.length >= 2).sort((a, b) => a.reynolds - b.reynolds);
  if (!candidates.length) return matching.some((polar) => polar.status === "needs-review")
    ? `翼型 ${airfoilId} のPolarは要確認です。翼型タブで再解析してください。`
    : `翼型 ${airfoilId} のPolarには補間可能な点がありません。`;
  const lower = [...candidates].reverse().find((polar) => polar.reynolds <= reynolds * (1 + 1e-10));
  const upper = candidates.find((polar) => polar.reynolds >= reynolds * (1 - 1e-10));
  if (!lower || !upper) return `翼型 ${airfoilId} の局所Re ${Math.round(reynolds)} はPolarのRe範囲外です（利用可能: ${candidates.map((polar) => Math.round(polar.reynolds)).join(", ")}）。`;
  const atAngle = (polar: AirfoilPolar) => {
    const points = [...polar.points].sort((a, b) => a.alpha - b.alpha);
    if (angle < points[0].alpha - 1e-10 || angle > points.at(-1)!.alpha + 1e-10) return undefined;
    const high = points.findIndex((point) => point.alpha >= angle - 1e-10);
    if (high <= 0) return points[0];
    const a = points[high - 1];
    const b = points[high];
    const ratio = (angle - a.alpha) / (b.alpha - a.alpha);
    return { cd: a.cd + (b.cd - a.cd) * ratio, cm: a.cm + (b.cm - a.cm) * ratio };
  };
  const a = atAngle(lower);
  const b = atAngle(upper);
  if (!a || !b) return `翼型 ${airfoilId} の局所迎角 ${angle.toFixed(2)}° はPolarの角度範囲外です。`;
  used.add(lower.id);
  used.add(upper.id);
  const ratio = lower.reynolds === upper.reynolds ? 0 : (reynolds - lower.reynolds) / (upper.reynolds - lower.reynolds);
  return { cd: a.cd + (b.cd - a.cd) * ratio, cm: a.cm + (b.cm - a.cm) * ratio };
}

function panelArea(panel: AircraftMeshPanel) {
  const [a, b, c, d] = panel.corners;
  const chord = subtract(d, a);
  const span = subtract(b, a);
  const otherChord = subtract(c, b);
  return (magnitude(cross(chord, span)) + magnitude(cross(otherChord, span))) / 2;
}

function panelSpanPosition(surface: TailSurface, panel: AircraftMeshPanel) {
  const [a, b] = panel.corners;
  const center = surface.orientation === "horizontal" ? (Math.abs(a.y - surface.rootPosition.y) + Math.abs(b.y - surface.rootPosition.y)) / 2
    : (a.z + b.z) / 2 - surface.rootPosition.z;
  return center;
}

function localTwist(surface: TailSurface, stripIndex: number) {
  let remaining = stripIndex;
  for (let index = 0; index < surface.sections.length - 1; index += 1) {
    const section = surface.sections[index];
    if (remaining < section.spanwisePanels) {
      const next = surface.sections[index + 1];
      return section.twist + (next.twist - section.twist) * (remaining + 0.5) / section.spanwisePanels;
    }
    remaining -= section.spanwisePanels;
  }
  return 0;
}

function localChord(surface: TailSurface, stripIndex: number) {
  let remaining = stripIndex;
  for (let index = 0; index < surface.sections.length - 1; index += 1) {
    const section = surface.sections[index];
    if (remaining < section.spanwisePanels) {
      const next = surface.sections[index + 1];
      const fractions = panelFractions(section.spanwisePanels, section.spanwiseDistribution);
      const fraction = (fractions[remaining] + fractions[remaining + 1]) / 2;
      return section.chord + (next.chord - section.chord) * fraction;
    }
    remaining -= section.spanwisePanels;
  }
  return 0;
}

function subtract(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function magnitude(a: { x: number; y: number; z: number }) { return Math.hypot(a.x, a.y, a.z); }
