import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AerodynamicSpanDistribution, AerodynamicSpanValues } from "../model/spanwiseDistribution";
import type { VlmPanelLoad } from "./vlmSolver";
import type { WingAnalysisMesh } from "./wingAnalysisMesh";

interface SectionCoefficients { cd: number; cm: number }

interface BaseInput {
  aircraft: AircraftGeometry;
  mesh: WingAnalysisMesh;
  alphaDegrees: number;
  speed: number;
  density: number;
  elasticAxisChordFraction?: number;
  sectionCoefficients: readonly SectionCoefficients[];
  targetCl: number;
  targetCdi: number;
  targetProfileCd: number;
}

export function createVlmSpanwiseDistribution(input: BaseInput & { panelLoads: readonly VlmPanelLoad[] }): AerodynamicSpanDistribution {
  const { aircraft, mesh, panelLoads, density, speed } = input;
  const q = density * speed ** 2 / 2;
  const coefficientForce = q * aircraft.wingArea;
  const raw = mesh.strips.map((strip, stripIndex) => {
    const width = strip.yEnd - strip.yStart;
    const loads = panelLoads.filter((load) => load.side === "right" && load.stripIndex === stripIndex);
    const lift = loads.reduce((sum, load) => sum + coefficientForce * load.cl, 0);
    const inducedDrag = loads.reduce((sum, load) => sum + coefficientForce * load.cdi, 0);
    const profileDrag = q * strip.chord * width * (input.sectionCoefficients[stripIndex]?.cd ?? 0);
    const pitchingMoment = q * strip.chord ** 2 * width * (input.sectionCoefficients[stripIndex]?.cm ?? 0);
    const elasticAxisX = chordPointX(mesh, stripIndex, input.elasticAxisChordFraction ?? 0.35);
    const torque = loads.reduce((sum, load) => sum + (elasticAxisX - load.applicationPoint.x) * coefficientForce * load.cl, 0) + pitchingMoment;
    return { strip, width, lift, inducedDrag, profileDrag, pitchingMoment, torque, circulation: loads.reduce((sum, load) => sum + load.circulation * speed, 0) };
  });
  return finishDistribution(input, raw);
}

export function createLltSpanwiseDistribution(input: BaseInput & { fourierCoefficients: readonly number[] }): AerodynamicSpanDistribution {
  const { aircraft, mesh, density, speed, fourierCoefficients } = input;
  const q = density * speed ** 2 / 2;
  const raw = mesh.strips.map((strip) => {
    const width = strip.yEnd - strip.yStart;
    const theta = Math.acos(Math.min(1, Math.max(0, strip.centerY / Math.max(aircraft.span / 2, 1e-12))));
    const circulation = 2 * aircraft.span * speed * fourierCoefficients.reduce((sum, coefficient, index) => sum + coefficient * Math.sin((2 * index + 1) * theta), 0);
    const lift = density * speed * circulation * width;
    const inducedAngle = fourierCoefficients.reduce((sum, coefficient, index) => sum + (2 * index + 1) * coefficient * Math.sin((2 * index + 1) * theta), 0) / Math.max(Math.sin(theta), 1e-12);
    const inducedDrag = Math.abs(lift * inducedAngle);
    const profileDrag = q * strip.chord * width * (input.sectionCoefficients[mesh.strips.indexOf(strip)]?.cd ?? 0);
    const pitchingMoment = q * strip.chord ** 2 * width * (input.sectionCoefficients[mesh.strips.indexOf(strip)]?.cm ?? 0);
    const torque = ((input.elasticAxisChordFraction ?? 0.35) - 0.25) * strip.chord * lift + pitchingMoment;
    return { strip, width, lift, inducedDrag, profileDrag, pitchingMoment, torque, circulation };
  });
  return finishDistribution(input, raw);
}

function finishDistribution(
  input: BaseInput,
  raw: readonly { strip: WingAnalysisMesh["strips"][number]; width: number; lift: number; inducedDrag: number; profileDrag: number; pitchingMoment: number; torque: number; circulation: number }[],
): AerodynamicSpanDistribution {
  const qS = input.density * input.speed ** 2 * input.aircraft.wingArea / 2;
  const liftScale = scaleTo(raw, "lift", qS * input.targetCl / 2);
  const inducedScale = scaleTo(raw, "inducedDrag", qS * input.targetCdi / 2);
  const profileScale = scaleTo(raw, "profileDrag", qS * input.targetProfileCd / 2);
  const samples = raw.map((point) => {
    const lift = point.lift * liftScale;
    const inducedDrag = point.inducedDrag * inducedScale;
    const profileDrag = point.profileDrag * profileScale;
    const values: AerodynamicSpanValues = {
      stationWidth: point.width,
      chord: point.strip.chord,
      circulation: point.circulation * liftScale,
      localLiftCoefficient: lift / Math.max(input.density * input.speed ** 2 / 2 * point.strip.chord * point.width, 1e-12),
      liftPerLength: lift / Math.max(point.width, 1e-12),
      inducedDragPerLength: inducedDrag / Math.max(point.width, 1e-12),
      profileDragPerLength: profileDrag / Math.max(point.width, 1e-12),
      dragPerLength: (inducedDrag + profileDrag) / Math.max(point.width, 1e-12),
      pitchingMomentPerLength: point.pitchingMoment / Math.max(point.width, 1e-12),
      torqueAboutElasticAxisPerLength: ((point.torque - point.pitchingMoment) * liftScale + point.pitchingMoment) / Math.max(point.width, 1e-12),
    };
    return { position: point.strip.centerY, values };
  });
  return {
    axis: { key: "semi-span", unit: "m", label: "半翼幅" },
    reference: { side: "right", origin: "centerline", alphaDegrees: input.alphaDegrees, speed: input.speed, density: input.density, elasticAxisChordFraction: input.elasticAxisChordFraction ?? 0.35 },
    samples,
  };
}

function scaleTo<T extends "lift" | "inducedDrag" | "profileDrag">(points: readonly Record<T, number>[], key: T, target: number) {
  const current = points.reduce((sum, point) => sum + point[key], 0);
  return Math.abs(current) < 1e-12 ? 0 : target / current;
}

function chordPointX(mesh: WingAnalysisMesh, stripIndex: number, chordFraction: number) {
  const nodes = mesh.panels.filter((panel) => panel.side === "right" && panel.stripIndex === stripIndex).flatMap((panel) => panel.corners);
  const leading = nodes.filter((node) => Math.abs(node.chordFraction) < 1e-10);
  const trailing = nodes.filter((node) => Math.abs(node.chordFraction - 1) < 1e-10);
  const average = (values: readonly { x: number }[]) => values.reduce((sum, node) => sum + node.x, 0) / Math.max(values.length, 1);
  return average(leading) + (average(trailing) - average(leading)) * chordFraction;
}

export function airDensityAtAltitude(altitude: number) {
  return 1.225 * Math.max(0.01, 1 - 2.25577e-5 * Math.max(0, altitude)) ** 5.25588;
}
