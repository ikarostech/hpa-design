import type { WingSection } from "./types";

export interface PositionedWingSection extends WingSection {
  zPosition: number;
}

export interface WingGeometryMetrics {
  span: number;
  rootChord: number;
  tipChord: number;
  taperRatio: number;
  twist: number;
  dihedral: number;
  sweep: number;
  wingArea: number;
  aspectRatio: number;
  mac: number;
  sectionPositions: PositionedWingSection[];
}

export function deriveWingGeometry(sections: readonly WingSection[]): WingGeometryMetrics {
  const sorted = [...sections].sort((left, right) => left.yPosition - right.yPosition);
  if (sorted.length < 2) return emptyMetrics(sorted);

  let halfWingArea = 0;
  let chordSquareIntegral = 0;
  let zPosition = 0;
  const sectionPositions: PositionedWingSection[] = sorted.map((section, index) => {
    if (index > 0) {
      const previous = sorted[index - 1];
      zPosition += (section.yPosition - previous.yPosition) * Math.tan(toRadians(previous.dihedral));
    }
    return { ...section, zPosition };
  });

  for (let index = 1; index < sorted.length; index += 1) {
    const root = sorted[index - 1];
    const tip = sorted[index];
    const length = tip.yPosition - root.yPosition;
    halfWingArea += length * (root.chord + tip.chord) / 2;
    chordSquareIntegral += length * (root.chord ** 2 + root.chord * tip.chord + tip.chord ** 2) / 3;
  }

  const root = sorted[0];
  const tip = sorted[sorted.length - 1];
  const semiSpan = tip.yPosition;
  const span = semiSpan * 2;
  const wingArea = halfWingArea * 2;
  const rootQuarterChord = root.xOffset + root.chord / 4;
  const tipQuarterChord = tip.xOffset + tip.chord / 4;
  const tipZ = sectionPositions[sectionPositions.length - 1].zPosition;

  return {
    span,
    rootChord: root.chord,
    tipChord: tip.chord,
    taperRatio: safeDivide(tip.chord, root.chord),
    twist: tip.twist - root.twist,
    dihedral: toDegrees(Math.atan2(tipZ, semiSpan)),
    sweep: toDegrees(Math.atan2(tipQuarterChord - rootQuarterChord, semiSpan)),
    wingArea,
    aspectRatio: safeDivide(span ** 2, wingArea),
    mac: safeDivide(chordSquareIntegral, halfWingArea),
    sectionPositions,
  };
}

export function validateWingSections(sections: readonly WingSection[], airfoilIds: ReadonlySet<string>) {
  const errors: string[] = [];
  if (sections.length < 2) return ["At least two wing sections are required."];

  const ids = new Set<string>();
  let previousPosition = Number.NEGATIVE_INFINITY;
  sections.forEach((section, index) => {
    const label = `Section ${index + 1}`;
    if (!section.id || ids.has(section.id)) errors.push(`${label}: ID must be unique.`);
    ids.add(section.id);
    if (!Number.isFinite(section.yPosition) || section.yPosition < 0) errors.push(`${label}: Y position must be zero or greater.`);
    if (index === 0 && section.yPosition !== 0) errors.push(`${label}: the root section Y position must be 0.`);
    if (section.yPosition <= previousPosition) errors.push(`${label}: Y position must increase from root to tip.`);
    previousPosition = section.yPosition;
    if (!Number.isFinite(section.chord) || section.chord <= 0) errors.push(`${label}: chord must be a positive number.`);
    if (!Number.isFinite(section.xOffset)) errors.push(`${label}: X offset must be a finite number.`);
    if (!Number.isFinite(section.twist) || !Number.isFinite(section.dihedral)) errors.push(`${label}: angles must be finite numbers.`);
    if (!isPanelCount(section.chordwisePanels)) errors.push(`${label}: chordwise panels must be an integer from 1 to 200.`);
    if (!isPanelCount(section.spanwisePanels)) errors.push(`${label}: spanwise panels must be an integer from 1 to 200.`);
    if (!airfoilIds.has(section.airfoilId)) errors.push(`${label}: select an existing airfoil.`);
  });
  return errors;
}

function isPanelCount(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 200;
}

function emptyMetrics(sections: readonly WingSection[]): WingGeometryMetrics {
  const sectionPositions = sections.map((section) => ({ ...section, zPosition: 0 }));
  const root = sections[0];
  return {
    span: 0,
    rootChord: root?.chord ?? 0,
    tipChord: root?.chord ?? 0,
    taperRatio: root ? 1 : 0,
    twist: 0,
    dihedral: 0,
    sweep: 0,
    wingArea: 0,
    aspectRatio: 0,
    mac: root?.chord ?? 0,
    sectionPositions,
  };
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function toDegrees(value: number) {
  return value * 180 / Math.PI;
}
