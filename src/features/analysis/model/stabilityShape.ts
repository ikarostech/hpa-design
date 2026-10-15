import type { StabilityShape } from "./types";

export interface StabilityFsiShapeOption {
  label: string;
  shape: Extract<StabilityShape, { kind: "fsi" }>;
}

export function stabilityShapeLabel(shape: StabilityShape | undefined): string {
  return shape?.kind === "manual" ? "簡易評価（仮のたわみ）" : shape?.kind === "fsi" ? "FSI後評価（固定形状）" : "剛体（比較基準）";
}

/** Also used at the JSON boundary; never assumes imported values have the declared type. */
export function stabilityShapeErrors(value: unknown, semiSpan?: number): string[] {
  if (value === undefined) return [];
  if (!record(value)) return ["評価形状が不正です。"];
  if (value.kind === "rigid") return [];
  if (value.kind === "manual") {
    const errors: string[] = [];
    if (!finite(value.elasticAxisChordFraction) || value.elasticAxisChordFraction < 0 || value.elasticAxisChordFraction > 1) errors.push("ねじり軸位置は0〜100%翼弦で指定してください。");
    if (!Array.isArray(value.points) || value.points.length < 2) return [...errors, "たわみ分布には翼根と翼端を含む2点以上が必要です。"];
    const points = value.points;
    if (points.some((p, i) => !record(p) || ![p.yPosition, p.deflection, p.twist].every(finite)
      || (p.yPosition as number) < 0 || (i > 0 && (p.yPosition as number) <= points[i - 1]?.yPosition))) errors.push("たわみ分布は有限値を使い、翼幅位置を0から昇順で指定してください。");
    if (points[0]?.yPosition !== 0 || (semiSpan !== undefined && Math.abs(points.at(-1)?.yPosition - semiSpan) > 1e-6)) errors.push("たわみ分布は翼根0 mから主翼半幅まで指定してください。");
    return errors;
  }
  if (value.kind === "fsi") {
    const errors: string[] = [];
    if (typeof value.resultId !== "string" || !value.resultId.trim() || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))
      || !finite(value.speed) || value.speed <= 0 || !finite(value.alphaDegrees)) errors.push("FSI形状の参照元と飛行条件が不正です。");
    if (!record(value.aircraftSnapshot) || typeof value.aircraftSnapshot.id !== "string" || !Array.isArray(value.aircraftSnapshot.sections)) errors.push("FSI元の機体形状が必要です。");
    const mesh = value.wingMesh;
    const node = (n: unknown) => record(n) && [n.x, n.y, n.z, n.chordFraction].every(finite)
      && (n.side === "left" || n.side === "right") && (n.chordFraction as number) >= 0 && (n.chordFraction as number) <= 1;
    if (!record(mesh) || !Array.isArray(mesh.nodes) || !mesh.nodes.length || !mesh.nodes.every(node)
      || !Array.isArray(mesh.panels) || !mesh.panels.length || mesh.panels.some((p) => !record(p) || !Array.isArray(p.corners) || p.corners.length !== 4 || !p.corners.every(node)
        || (p.side !== "left" && p.side !== "right") || typeof p.airfoilRootId !== "string" || typeof p.airfoilTipId !== "string"
        || !Number.isInteger(p.stripIndex) || !Number.isInteger(p.chordIndex)) || !Array.isArray(mesh.strips)) errors.push("FSIの変形メッシュが不正です。");
    return errors;
  }
  return ["剛体・簡易評価・FSI後評価から選択してください。"];
}

function record(value: unknown): value is Record<string, any> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
