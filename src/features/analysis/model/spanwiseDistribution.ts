import type { DistributionAxis, OneDimensionalDistribution } from "../../../shared/model";

export interface AerodynamicSpanValues {
  stationWidth: number;
  chord: number;
  circulation: number;
  localLiftCoefficient: number;
  liftPerLength: number;
  inducedDragPerLength: number;
  profileDragPerLength: number;
  dragPerLength: number;
  pitchingMomentPerLength: number;
  torqueAboutElasticAxisPerLength: number;
}

export interface AerodynamicSpanDistribution extends OneDimensionalDistribution<AerodynamicSpanValues> {
  axis: DistributionAxis & { key: "semi-span"; unit: "m" };
  reference: {
    side: "right";
    origin: "centerline";
    alphaDegrees: number;
    speed: number;
    density: number;
    elasticAxisChordFraction: number;
  };
}
