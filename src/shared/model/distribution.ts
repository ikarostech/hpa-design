export type DistributionValue = number | null;

export interface DistributionAxis {
  key: string;
  unit: string;
  label?: string;
}

export interface DistributionSample<TValues> {
  position: number;
  values: Readonly<TValues>;
}

export interface OneDimensionalDistribution<TValues> {
  axis: DistributionAxis;
  samples: readonly DistributionSample<TValues>[];
}
