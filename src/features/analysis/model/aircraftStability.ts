export interface StabilityPoint {
  alpha: number;
  cl: number;
  cm: number;
  /** Directional moment derivative with respect to sideslip, per radian. */
  cnBeta?: number;
  crBeta?: number;
  cyBeta?: number;
}

export interface AircraftStabilitySummary {
  trimAlpha: number | null;
  trimCl: number | null;
  cmAlphaPerDegree: number | null;
  staticMarginPercent: number | null;
  cnBetaPerRadian: number | null;
  crBetaPerRadian: number | null;
  cyBetaPerRadian: number | null;
  derivativeAlpha: number | null;
}

/** Local finite-difference estimates from a rigid, inviscid aircraft sweep. */
export function summarizeAircraftStability(points: readonly StabilityPoint[]): AircraftStabilitySummary {
  const rows = [...points].filter((row) => [row.alpha, row.cl, row.cm].every(Number.isFinite)).sort((a, b) => a.alpha - b.alpha);
  const trimPair = rows.slice(1).map((next, index) => [rows[index], next] as const)
    .find(([a, b]) => a.cm === 0 || b.cm === 0 || a.cm * b.cm < 0);
  const trimFraction = trimPair && trimPair[0].cm !== trimPair[1].cm
    ? -trimPair[0].cm / (trimPair[1].cm - trimPair[0].cm) : null;
  const trimAlpha = trimPair && trimFraction !== null
    ? trimPair[0].alpha + trimFraction * (trimPair[1].alpha - trimPair[0].alpha) : null;
  const trimCl = trimPair && trimFraction !== null
    ? trimPair[0].cl + trimFraction * (trimPair[1].cl - trimPair[0].cl) : null;
  const pair = trimPair ?? (rows.length >= 2 ? [rows[0], rows.at(-1)!] as const : null);
  const deltaAlpha = pair ? pair[1].alpha - pair[0].alpha : 0;
  const deltaCl = pair ? pair[1].cl - pair[0].cl : 0;
  const cmAlphaPerDegree = pair && deltaAlpha !== 0 ? (pair[1].cm - pair[0].cm) / deltaAlpha : null;
  const staticMarginPercent = pair && Math.abs(deltaCl) > 1e-9 ? -100 * (pair[1].cm - pair[0].cm) / deltaCl : null;
  const nearest = rows.reduce<StabilityPoint | null>((best, row) => !best || Math.abs(row.alpha) < Math.abs(best.alpha) ? row : best, null);
  const derivative = (key: "cnBeta" | "crBeta" | "cyBeta") => {
    if (trimPair && trimFraction !== null) {
      const a = trimPair[0][key];
      const b = trimPair[1][key];
      return a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b) ? a + trimFraction * (b - a) : null;
    }
    const value = nearest?.[key];
    return value !== undefined && Number.isFinite(value) ? value : null;
  };
  return { trimAlpha, trimCl, cmAlphaPerDegree, staticMarginPercent,
    cnBetaPerRadian: derivative("cnBeta"), crBetaPerRadian: derivative("crBeta"), cyBetaPerRadian: derivative("cyBeta"),
    derivativeAlpha: trimAlpha ?? nearest?.alpha ?? null };
}
