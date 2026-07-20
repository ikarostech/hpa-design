import type { FieldErrors } from "../../../shared/model";
import type { XfoilAnalysisSettings } from "./analysis";

export type XfoilAnalysisValidation =
  | { valid: true; sweepPoints: number; errors?: never }
  | { valid: false; errors: FieldErrors<XfoilAnalysisSettings>; sweepPoints?: never };

export function validateXfoilAnalysisSettings(settings: XfoilAnalysisSettings): XfoilAnalysisValidation {
  const errors: FieldErrors<XfoilAnalysisSettings> = {};
  if (!Number.isFinite(settings.reynolds) || settings.reynolds <= 0) errors.reynolds = "Re数は正の有限値にしてください。";
  if (!Number.isFinite(settings.mach) || settings.mach < 0 || settings.mach > 0.8) errors.mach = "Mach数は 0 以上 0.8 以下の有限値にしてください。";
  if (!Number.isFinite(settings.alphaStart) || !Number.isFinite(settings.alphaEnd) || settings.alphaStart > settings.alphaEnd) errors.alphaStart = "α開始は α終了以下の有限値にしてください。";
  if (!Number.isFinite(settings.alphaStep) || settings.alphaStep <= 0) errors.alphaStep = "α刻みは正の有限値にしてください。";
  if (!Number.isFinite(settings.ncrit) || settings.ncrit < 1 || settings.ncrit > 14) errors.ncrit = "Ncrit は 1 から 14 の範囲にしてください。";
  if (!Number.isFinite(settings.iterations) || !Number.isInteger(settings.iterations) || settings.iterations < 10 || settings.iterations > 300) errors.iterations = "反復回数は 10 から 300 の整数にしてください。";

  const sweepPoints = !errors.alphaStart && !errors.alphaStep
    ? Math.floor((settings.alphaEnd - settings.alphaStart) / settings.alphaStep) + 1
    : 0;
  if (sweepPoints > 121) errors.alphaStep = "α sweep は 121 点以下にしてください。";

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, sweepPoints };
}
