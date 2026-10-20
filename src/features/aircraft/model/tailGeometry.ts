import type { AircraftPosition, TailSurface, TailSurfaceSection } from "./types";
import { isValidSparChordFraction } from "./sparGeometry";

export interface TailGeometryMetrics {
  span: number;
  projectedSpan: number;
  area: number;
  projectedArea: number;
  aspectRatio: number;
  meanAerodynamicChord: number;
  taperRatio: number;
  aerodynamicCenter: AircraftPosition;
}

export function deriveTailGeometry(surface: TailSurface): TailGeometryMetrics {
  const sections = [...surface.sections].sort((left, right) => left.spanPosition - right.spanPosition);
  const mirrorFactor = surface.orientation === "horizontal" ? 2 : 1;
  let oneSideArea = 0;
  let oneSideProjectedArea = 0;
  let projectedSemiSpan = 0;
  let chordSquareIntegral = 0;
  let firstSpanMoment = 0;
  let quarterChordMoment = 0;

  for (let index = 1; index < sections.length; index += 1) {
    const root = sections[index - 1];
    const tip = sections[index];
    const length = tip.spanPosition - root.spanPosition;
    const panelArea = integrateLinearProduct(length, root.chord, tip.chord, 1, 1);
    const projectionFactor = Math.abs(Math.cos(toRadians(root.dihedral)));
    oneSideArea += panelArea;
    oneSideProjectedArea += panelArea * projectionFactor;
    projectedSemiSpan += length * projectionFactor;
    chordSquareIntegral += integrateLinearProduct(length, root.chord, tip.chord, root.chord, tip.chord);
    firstSpanMoment += integrateSpanTimesLinear(length, root.spanPosition, root.chord, tip.chord);
    quarterChordMoment += integrateLinearProduct(
      length,
      root.chord,
      tip.chord,
      root.xOffset + root.chord / 4,
      tip.xOffset + tip.chord / 4,
    );
  }

  const semiSpan = sections.at(-1)?.spanPosition ?? 0;
  const area = oneSideArea * mirrorFactor;
  const span = semiSpan * mirrorFactor;
  const spanwiseCenter = safeDivide(firstSpanMoment, oneSideArea);
  const aerodynamicCenter = {
    x: surface.rootPosition.x + safeDivide(quarterChordMoment, oneSideArea),
    y: surface.rootPosition.y,
    z: surface.rootPosition.z + (surface.orientation === "vertical" ? spanwiseCenter : 0),
  };

  return {
    span,
    projectedSpan: projectedSemiSpan * mirrorFactor,
    area,
    projectedArea: oneSideProjectedArea * mirrorFactor,
    aspectRatio: safeDivide(span ** 2, area),
    meanAerodynamicChord: safeDivide(chordSquareIntegral, oneSideArea),
    taperRatio: safeDivide(sections.at(-1)?.chord ?? 0, sections[0]?.chord ?? 0),
    aerodynamicCenter,
  };
}

export function validateTailSurface(surface: TailSurface, airfoilIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (!surface.id.trim()) errors.push("Tail surface ID is required.");
  if (!surface.name.trim()) errors.push("Tail surface name is required.");
  for (const [axis, value] of Object.entries(surface.rootPosition)) {
    if (!Number.isFinite(value)) errors.push(`Tail root ${axis.toUpperCase()} position must be finite.`);
  }
  if (!Number.isFinite(surface.incidence)) errors.push("Tail incidence must be finite.");
  if (surface.sparChordFraction !== undefined && !isValidSparChordFraction(surface.sparChordFraction)) errors.push("Tail spar position must be between 0 and 100% of the chord.");
  if (surface.orientation === "horizontal" && (surface.isDoubleFin || surface.isSymmetricFin)) errors.push("XFLR5 fin flags are valid only for vertical tails.");
  if (surface.isSymmetricFin && !surface.isDoubleFin) errors.push("An XFLR5 symmetric fin arrangement requires double-fin mode.");
  if (surface.isDoubleFin) errors.push("Double Finには対応していません。単一の垂直尾翼を使用してください。");
  if (surface.isSymmetricFin) errors.push("Symmetric Finには対応していません。単一の垂直尾翼を使用してください。");
  errors.push(...validateSections(surface.sections, airfoilIds));
  return errors;
}

function validateSections(sections: readonly TailSurfaceSection[], airfoilIds: ReadonlySet<string>) {
  if (sections.length < 2) return ["At least two tail sections are required."];
  const errors: string[] = [];
  const ids = new Set<string>();
  let previousPosition = Number.NEGATIVE_INFINITY;
  sections.forEach((section, index) => {
    const label = `Tail section ${index + 1}`;
    if (!section.id || ids.has(section.id)) errors.push(`${label}: ID must be unique.`);
    ids.add(section.id);
    if (!Number.isFinite(section.spanPosition) || section.spanPosition < 0) errors.push(`${label}: span position must be zero or greater.`);
    if (index === 0 && section.spanPosition !== 0) errors.push(`${label}: the root section span position must be 0.`);
    if (section.spanPosition <= previousPosition) errors.push(`${label}: span position must increase from root to tip.`);
    previousPosition = section.spanPosition;
    if (!Number.isFinite(section.chord) || section.chord <= 0) errors.push(`${label}: chord must be a positive number.`);
    if (!Number.isFinite(section.xOffset)) errors.push(`${label}: X offset must be finite.`);
    if (!Number.isFinite(section.dihedral)) errors.push(`${label}: dihedral must be finite.`);
    if (!Number.isFinite(section.twist)) errors.push(`${label}: twist must be finite.`);
    if (!isPanelCount(section.chordwisePanels)) errors.push(`${label}: chordwise panels must be an integer from 1 to 200.`);
    if (!isPanelCount(section.spanwisePanels)) errors.push(`${label}: spanwise panels must be an integer from 1 to 200.`);
    if (!airfoilIds.has(section.leftAirfoilId)) errors.push(`${label}: select an existing left-side airfoil.`);
    if (!airfoilIds.has(section.rightAirfoilId)) errors.push(`${label}: select an existing right-side airfoil.`);
  });
  return errors;
}

function integrateLinearProduct(length: number, leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return length * (2 * leftStart * rightStart + leftStart * rightEnd + leftEnd * rightStart + 2 * leftEnd * rightEnd) / 6;
}

function integrateSpanTimesLinear(length: number, spanStart: number, valueStart: number, valueEnd: number) {
  return length * (spanStart * (valueStart + valueEnd) / 2 + length * (valueStart + 2 * valueEnd) / 6);
}

function isPanelCount(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 200;
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}
