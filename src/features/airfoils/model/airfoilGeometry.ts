import type { Importer, ValidationIssue, ValidationResult } from "@/shared/model";
import type { Airfoil } from "./types";

type SurfacePoint = { x: number; y: number };

export type AirfoilDatFormat = "selig" | "lednicer";

export interface ParsedAirfoilDat {
  name: string;
  format: AirfoilDatFormat;
  coordinates: Airfoil["coordinates"];
  issues: readonly ValidationIssue[];
}

/**
 * Imports the two coordinate layouts commonly found in .dat airfoil files.
 * The result is normalized to a unit chord and the shared upper/lower grid
 * used by the rest of the airfoil feature.
 */
export const airfoilDatImporter: Importer<string, ParsedAirfoilDat> = {
  parse: async (input) => parseAirfoilDat(input),
  validate: async (result) => validateAirfoilDat(result),
};

export function parseAirfoilDat(text: string): ParsedAirfoilDat {
  const lines = readDataLines(text);
  if (!lines.numeric.length) {
    throw new Error("翼型座標が見つかりません。名前の次の行から x y の座標を指定してください。");
  }

  const name = lines.labels[0] ?? "Imported airfoil";
  const first = lines.numeric[0];
  const lednicer = isPointCountLine(first.values);
  const issues: ValidationIssue[] = [];
  let upper: SurfacePoint[];
  let lower: SurfacePoint[];

  if (lednicer) {
    const [upperCount, lowerCount] = first.values;
    const points = lines.numeric.slice(1).map((line) => toPoint(line.values));
    if (points.length !== upperCount + lowerCount) {
      throw new Error(`Lednicer形式の点数が一致しません。上面 ${upperCount} 点、下面 ${lowerCount} 点が必要です。`);
    }
    upper = points.slice(0, upperCount);
    lower = points.slice(upperCount);
  } else {
    const points = lines.numeric.map((line) => toPoint(line.values));
    if (points.length < 5) {
      throw new Error("Selig形式には少なくとも5点の座標が必要です。");
    }

    const leadingEdgeIndex = findLeadingEdgeIndex(points);
    if (leadingEdgeIndex === 0 || leadingEdgeIndex === points.length - 1) {
      throw new Error("Selig形式は、上面後縁から前縁を経由して下面後縁へ続く座標列で指定してください。");
    }
    upper = points.slice(0, leadingEdgeIndex + 1).reverse();
    lower = points.slice(leadingEdgeIndex);
  }

  const sourceX = [...upper, ...lower].map((point) => point.x);
  const minX = Math.min(...sourceX);
  const maxX = Math.max(...sourceX);
  if (minX < -0.01 || maxX > 1.01) {
    issues.push({
      severity: "warning",
      message: `x座標を ${minX.toFixed(4)}–${maxX.toFixed(4)} から単位コード長へ正規化しました。`,
    });
  }

  const coordinates = normalizeSurfaces(upper, lower);
  return { name, format: lednicer ? "lednicer" : "selig", coordinates, issues };
}

export function validateAirfoilDat(result: ParsedAirfoilDat): ValidationResult {
  const issues = [...result.issues];
  if (result.coordinates.length < 3) {
    issues.push({ severity: "error", message: "翼型の各面には少なくとも3点が必要です。" });
  }
  if (result.coordinates.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.upper) || !Number.isFinite(point.lower))) {
    issues.push({ severity: "error", message: "有限ではない座標値が含まれています。" });
  }
  if (result.coordinates.some((point) => point.upper < point.lower)) {
    issues.push({ severity: "error", message: "上面が下面より下にある座標が含まれています。" });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return errors.length ? { valid: false, issues } : { valid: true, issues };
}

export function createAirfoilFromDat(imported: ParsedAirfoilDat, id: string, name = imported.name): Airfoil {
  const metrics = getAirfoilMetrics(imported.coordinates);
  return {
    id,
    name: name.trim() || imported.name,
    ...metrics,
    coordinates: imported.coordinates,
  };
}

export function createNaca4Airfoil(code: string, id: string, pointCount = 81): Airfoil {
  const normalizedCode = code.trim();
  if (!isNaca4Code(normalizedCode)) {
    throw new Error("NACA 4桁は 0012 または 2412 のように4桁で指定してください。");
  }
  if (pointCount < 3) {
    throw new Error("NACA翼型の生成には3点以上が必要です。");
  }

  const m = Number(normalizedCode[0]) / 100;
  const p = Number(normalizedCode[1]) / 10;
  const t = Number(normalizedCode.slice(2)) / 100;
  if (m > 0 && p === 0) {
    throw new Error("キャンバーを持つNACA翼型では、第2桁を1以上にしてください。");
  }
  if (t === 0) {
    throw new Error("翼厚は 01 以上にしてください。");
  }

  const upper: SurfacePoint[] = [];
  const lower: SurfacePoint[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const beta = Math.PI * index / (pointCount - 1);
    const x = (1 - Math.cos(beta)) / 2;
    const thickness = 5 * t * (
      0.2969 * Math.sqrt(x)
      - 0.126 * x
      - 0.3516 * x ** 2
      + 0.2843 * x ** 3
      - 0.1036 * x ** 4
    );
    const { camber, slope } = getNacaCamberLine(x, m, p);
    const angle = Math.atan(slope);
    upper.push({ x: x - thickness * Math.sin(angle), y: camber + thickness * Math.cos(angle) });
    lower.push({ x: x + thickness * Math.sin(angle), y: camber - thickness * Math.cos(angle) });
  }

  return {
    id,
    name: `NACA${normalizedCode}`,
    thicknessRatio: round(t * 100, 3),
    maxCamber: round(m * 100, 3),
    leadingEdgeRadius: round(1.1019 * t ** 2 * 100, 3),
    trailingEdgeThickness: 0,
    coordinates: normalizeSurfaces(upper, lower),
  };
}

export function isNaca4Code(value: string) {
  return /^\d{4}$/.test(value);
}

function readDataLines(text: string) {
  const labels: string[] = [];
  const numeric: Array<{ values: [number, number]; line: number }> = [];
  let dataStarted = false;

  for (const [index, original] of text.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    const line = original.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const values = parsePair(line);
    if (!dataStarted && !values) {
      labels.push(line);
      continue;
    }
    if (!values) {
      throw new Error(`${index + 1}行目は2つの数値座標ではありません。`);
    }
    dataStarted = true;
    numeric.push({ values, line: index + 1 });
  }

  return { labels, numeric };
}

function parsePair(line: string): [number, number] | null {
  const values = line.split(/[\s,]+/).filter(Boolean);
  if (values.length !== 2) {
    return null;
  }
  const first = Number(values[0].replace(/[dD]/g, "e"));
  const second = Number(values[1].replace(/[dD]/g, "e"));
  return Number.isFinite(first) && Number.isFinite(second) ? [first, second] : null;
}

function isPointCountLine([upper, lower]: [number, number]) {
  return Number.isInteger(upper) && Number.isInteger(lower) && upper > 1 && lower > 1;
}

function toPoint([x, y]: [number, number]): SurfacePoint {
  return { x, y };
}

function findLeadingEdgeIndex(points: readonly SurfacePoint[]) {
  return points.reduce((bestIndex, point, index) => point.x < points[bestIndex].x ? index : bestIndex, 0);
}

function normalizeSurfaces(upper: readonly SurfacePoint[], lower: readonly SurfacePoint[]): Airfoil["coordinates"] {
  if (upper.length < 2 || lower.length < 2) {
    throw new Error("上面・下面とも2点以上の座標が必要です。");
  }
  const rawPoints = [...upper, ...lower];
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const chord = maxX - minX;
  if (!Number.isFinite(chord) || chord <= 1e-9) {
    throw new Error("コード長を求められません。x座標には幅が必要です。");
  }

  const normalizedUpper = prepareSurface(upper, minX, chord);
  const normalizedLower = prepareSurface(lower, minX, chord);
  const xValues = [...new Set([...normalizedUpper, ...normalizedLower].map((point) => point.x.toFixed(10)))].map(Number).sort((a, b) => a - b);
  if (xValues.length < 3) {
    throw new Error("異なるx座標が3点以上必要です。");
  }

  return xValues.map((x) => ({
    x,
    upper: interpolate(normalizedUpper, x),
    lower: interpolate(normalizedLower, x),
  }));
}

function prepareSurface(surface: readonly SurfacePoint[], minX: number, chord: number) {
  const sorted = surface
    .map((point) => ({ x: (point.x - minX) / chord, y: point.y / chord }))
    .sort((left, right) => left.x - right.x);
  const merged: SurfacePoint[] = [];
  for (const point of sorted) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.x - point.x) < 1e-9) {
      last.y = (last.y + point.y) / 2;
    } else {
      merged.push(point);
    }
  }
  return merged;
}

function interpolate(surface: readonly SurfacePoint[], x: number) {
  if (x <= surface[0].x) {
    return surface[0].y;
  }
  const last = surface[surface.length - 1];
  if (x >= last.x) {
    return last.y;
  }
  const rightIndex = surface.findIndex((point) => point.x >= x);
  const left = surface[rightIndex - 1];
  const right = surface[rightIndex];
  const ratio = (x - left.x) / (right.x - left.x);
  return left.y + (right.y - left.y) * ratio;
}

function getNacaCamberLine(x: number, m: number, p: number) {
  if (m === 0) {
    return { camber: 0, slope: 0 };
  }
  if (x < p) {
    return {
      camber: m / p ** 2 * (2 * p * x - x ** 2),
      slope: 2 * m / p ** 2 * (p - x),
    };
  }
  return {
    camber: m / (1 - p) ** 2 * ((1 - 2 * p) + 2 * p * x - x ** 2),
    slope: 2 * m / (1 - p) ** 2 * (p - x),
  };
}

function getAirfoilMetrics(coordinates: Airfoil["coordinates"]) {
  const maxThickness = coordinates.reduce((best, point) => point.upper - point.lower > best.upper - best.lower ? point : best, coordinates[0]);
  const maxCamber = coordinates.reduce((best, point) => Math.abs((point.upper + point.lower) / 2) > Math.abs((best.upper + best.lower) / 2) ? point : best, coordinates[0]);
  const leadingEdgeRadius = estimateLeadingEdgeRadius(coordinates);
  const trailingEdge = coordinates[coordinates.length - 1];

  return {
    thicknessRatio: round((maxThickness.upper - maxThickness.lower) * 100, 3),
    maxCamber: round(((maxCamber.upper + maxCamber.lower) / 2) * 100, 3),
    leadingEdgeRadius: round(leadingEdgeRadius * 100, 3),
    trailingEdgeThickness: round(Math.abs(trailingEdge.upper - trailingEdge.lower) * 100, 3),
  };
}

function estimateLeadingEdgeRadius(coordinates: Airfoil["coordinates"]) {
  const points = coordinates.slice(0, 3).map((point) => ({ x: point.x, y: point.upper }));
  if (points.length < 3) {
    return 0;
  }
  const [first, second, third] = points;
  const a = Math.hypot(second.x - third.x, second.y - third.y);
  const b = Math.hypot(first.x - third.x, first.y - third.y);
  const c = Math.hypot(first.x - second.x, first.y - second.y);
  const twiceArea = Math.abs(
    first.x * (second.y - third.y)
    + second.x * (third.y - first.y)
    + third.x * (first.y - second.y),
  );
  return twiceArea > 1e-12 ? a * b * c / (2 * twiceArea) : 0;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
