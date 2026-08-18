import type { AircraftGeometry, WingSection } from "../../aircraft/model/types";

export interface LltOptions {
  sectionLiftCurveSlope?: number;
  zeroLiftAngle?: number;
  stationCount?: number;
}

export interface LltCoefficients {
  cl: number;
  cdi: number;
  spanEfficiency: number;
  fourierCoefficients: readonly number[];
}

export function calculateLltCoefficients(
  aircraft: AircraftGeometry,
  alphaDegrees: number,
  options: LltOptions = {},
): LltCoefficients {
  const stationCount = Math.max(4, Math.min(80, Math.round(options.stationCount ?? 15)));
  const sectionSlope = options.sectionLiftCurveSlope ?? 2 * Math.PI;
  const zeroLiftAngle = options.zeroLiftAngle ?? 0;
  const halfSpan = aircraft.span / 2;
  if (halfSpan <= 0 || aircraft.wingArea <= 0 || aircraft.sections.length < 2) return { cl: 0, cdi: 0, spanEfficiency: 0, fourierCoefficients: [] };

  const matrix: number[][] = [];
  const rhs: number[] = [];
  for (let row = 0; row < stationCount; row += 1) {
    const theta = (row + 1) * Math.PI / (2 * stationCount);
    const spanPosition = halfSpan * Math.cos(theta);
    const section = interpolateSection(aircraft.sections, spanPosition);
    const localSlope = sectionSlope
      * Math.max(0.2, Math.cos(section.quarterChordSweep))
      * Math.max(0.2, Math.cos(section.dihedral));
    const localAlpha = (alphaDegrees + aircraft.incidence + section.twist - zeroLiftAngle) * Math.PI / 180;
    const coefficients: number[] = [];
    for (let column = 0; column < stationCount; column += 1) {
      const harmonic = 2 * column + 1;
      coefficients.push(Math.sin(harmonic * theta) * (
        4 * aircraft.span / (localSlope * Math.max(section.chord, 1e-9))
        + harmonic / Math.sin(theta)
      ));
    }
    matrix.push(coefficients);
    rhs.push(localAlpha);
  }

  const fourier = solveLinearSystem(matrix, rhs);
  const aspectRatio = aircraft.span ** 2 / aircraft.wingArea;
  const cl = Math.PI * aspectRatio * fourier[0];
  const dragFactor = fourier.slice(1).reduce((sum, coefficient, index) => {
    const harmonic = 2 * (index + 1) + 1;
    return sum + harmonic * (coefficient / fourier[0]) ** 2;
  }, 0);
  const spanEfficiency = fourier[0] === 0 ? 1 : 1 / (1 + dragFactor);
  const cdi = cl ** 2 / (Math.PI * aspectRatio * spanEfficiency);
  return { cl, cdi, spanEfficiency, fourierCoefficients: fourier };
}

function interpolateSection(sections: readonly WingSection[], yPosition: number) {
  const sorted = [...sections].sort((left, right) => left.yPosition - right.yPosition);
  const upperIndex = sorted.findIndex((section) => section.yPosition >= yPosition);
  if (upperIndex <= 0) return sectionProperties(sorted[0], sorted[1]);
  if (upperIndex < 0) return sectionProperties(sorted[sorted.length - 2], sorted[sorted.length - 1]);
  const root = sorted[upperIndex - 1];
  const tip = sorted[upperIndex];
  const ratio = (yPosition - root.yPosition) / Math.max(tip.yPosition - root.yPosition, 1e-9);
  const quarterChordRoot = root.xOffset + root.chord / 4;
  const quarterChordTip = tip.xOffset + tip.chord / 4;
  return {
    chord: interpolate(root.chord, tip.chord, ratio),
    twist: interpolate(root.twist, tip.twist, ratio),
    dihedral: root.dihedral * Math.PI / 180,
    quarterChordSweep: Math.atan2(quarterChordTip - quarterChordRoot, tip.yPosition - root.yPosition),
  };
}

function sectionProperties(root: WingSection, tip: WingSection) {
  return {
    chord: root.chord,
    twist: root.twist,
    dihedral: root.dihedral * Math.PI / 180,
    quarterChordSweep: Math.atan2(
      tip.xOffset + tip.chord / 4 - root.xOffset - root.chord / 4,
      tip.yPosition - root.yPosition,
    ),
  };
}

function solveLinearSystem(matrix: number[][], values: number[]) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-12) throw new Error("LLT influence matrix is singular.");
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let entry = column; entry <= size; entry += 1) rows[column][entry] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry <= size; entry += 1) rows[row][entry] -= factor * rows[column][entry];
    }
  }
  return rows.map((row) => row[size]);
}

function interpolate(start: number, end: number, ratio: number) { return start + (end - start) * ratio; }
