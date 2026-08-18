export interface LiftTrimResult {
  alphaDegrees: number;
  lift: number;
  relativeError: number;
  iterations: number;
}

export function solveLiftTrim({
  targetLift,
  minimumAlpha,
  maximumAlpha,
  relativeTolerance = 1e-4,
  maxIterations = 80,
  evaluateLift,
}: {
  targetLift: number;
  minimumAlpha: number;
  maximumAlpha: number;
  relativeTolerance?: number;
  maxIterations?: number;
  evaluateLift: (alphaDegrees: number) => number;
}): LiftTrimResult {
  if (!(targetLift > 0) || !(maximumAlpha > minimumAlpha) || !(relativeTolerance > 0) || maxIterations < 1) {
    throw new Error("揚力トリム条件が不正です。");
  }
  let lowerAlpha = minimumAlpha;
  let upperAlpha = maximumAlpha;
  let lowerLift = finiteLift(evaluateLift(lowerAlpha));
  let upperLift = finiteLift(evaluateLift(upperAlpha));
  let lowerResidual = lowerLift - targetLift;
  let upperResidual = upperLift - targetLift;
  if (lowerResidual === 0) return result(lowerAlpha, lowerLift, targetLift, 0);
  if (upperResidual === 0) return result(upperAlpha, upperLift, targetLift, 0);
  if (lowerResidual * upperResidual > 0) throw new Error("目標揚力を指定迎角範囲で挟めません。");

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const alpha = (lowerAlpha + upperAlpha) / 2;
    const lift = finiteLift(evaluateLift(alpha));
    const current = result(alpha, lift, targetLift, iteration);
    if (current.relativeError <= relativeTolerance) return current;
    const residual = lift - targetLift;
    if (lowerResidual * residual <= 0) {
      upperAlpha = alpha;
      upperLift = lift;
      upperResidual = residual;
    } else {
      lowerAlpha = alpha;
      lowerLift = lift;
      lowerResidual = residual;
    }
  }
  const lower = result(lowerAlpha, lowerLift, targetLift, maxIterations);
  const upper = result(upperAlpha, upperLift, targetLift, maxIterations);
  return lower.relativeError <= upper.relativeError ? lower : upper;
}

function result(alphaDegrees: number, lift: number, targetLift: number, iterations: number): LiftTrimResult {
  return {
    alphaDegrees,
    lift,
    relativeError: Math.abs(lift - targetLift) / Math.max(Math.abs(targetLift), 1),
    iterations,
  };
}

function finiteLift(lift: number) {
  if (!Number.isFinite(lift)) throw new Error("揚力評価が有限値ではありません。");
  return lift;
}
