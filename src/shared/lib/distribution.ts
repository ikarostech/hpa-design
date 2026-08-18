import type { DistributionValue, OneDimensionalDistribution } from "../model";

type NumericValues<TValues> = { [K in keyof TValues]: DistributionValue };

export function validateDistribution<TValues>(distribution: OneDimensionalDistribution<TValues>) {
  const issues: string[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (const sample of distribution.samples) {
    if (!Number.isFinite(sample.position)) issues.push("座標は有限値である必要があります。");
    if (sample.position <= previous) issues.push("座標は昇順かつ重複なしである必要があります。");
    previous = sample.position;
    if (Object.values(sample.values as object).some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value)))) {
      issues.push("分布値は有限値またはnullである必要があります。");
    }
  }
  return Array.from(new Set(issues));
}

export function interpolateDistribution<TValues extends NumericValues<TValues>>(
  distribution: OneDimensionalDistribution<TValues>,
  position: number,
): TValues | null {
  const samples = distribution.samples;
  if (!samples.length || position < samples[0].position || position > samples.at(-1)!.position) return null;
  const exact = samples.find((sample) => sample.position === position);
  if (exact) return { ...exact.values };
  const upperIndex = samples.findIndex((sample) => sample.position > position);
  if (upperIndex <= 0) return null;
  const lower = samples[upperIndex - 1];
  const upper = samples[upperIndex];
  const ratio = (position - lower.position) / (upper.position - lower.position);
  return Object.fromEntries(Object.keys(lower.values).map((key) => {
    const lowerValue = lower.values[key as keyof TValues];
    const upperValue = upper.values[key as keyof TValues];
    return [key, lowerValue === null || upperValue === null ? null : lowerValue + (upperValue - lowerValue) * ratio];
  })) as TValues;
}

export function resampleDistribution<TValues extends NumericValues<TValues>>(
  distribution: OneDimensionalDistribution<TValues>,
  positions: readonly number[],
): OneDimensionalDistribution<TValues> {
  return {
    axis: { ...distribution.axis },
    samples: positions.map((position) => ({ position, values: interpolateDistribution(distribution, position) }))
      .filter((sample): sample is { position: number; values: TValues } => sample.values !== null),
  };
}

export function mergeDistributionCoordinates(distributions: readonly OneDimensionalDistribution<unknown>[]) {
  return Array.from(new Set(distributions.flatMap((distribution) => distribution.samples.map((sample) => sample.position)))).sort((left, right) => left - right);
}
