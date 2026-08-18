export interface AerodynamicSpanLoadPoint {
  yPosition: number;
  width: number;
  circulation: number;
  liftPerLength: number;
  dragPerLength: number;
  torquePerLength: number;
}

export interface AerodynamicLoadTransferResult {
  points: AerodynamicSpanLoadPoint[];
  forceBalanceError: number;
  momentBalanceError: number;
}

export interface BeamDeformationPoint {
  yPosition: number;
  deflection: number;
  rotation: number;
  twist: number;
}

export type AeroelasticCondition =
  | { mode: "fixed-alpha"; alphaDegrees: number }
  | { mode: "target-lift"; targetLift: number; minimumAlpha: number; maximumAlpha: number };

export interface StaticAeroelasticSettings {
  maxIterations: number;
  relaxationFactor: number;
  displacementTolerance: number;
  loadTolerance: number;
  liftTolerance: number;
}

export interface AeroelasticIteration {
  iteration: number;
  alphaDegrees: number;
  cl: number;
  cdi: number;
  totalLift: number;
  maxDeflection: number;
  maxTwist: number;
  displacementResidual: number;
  loadResidual: number | null;
  liftResidual: number;
}

export type AeroelasticConvergenceStatus = "converged" | "max-iterations" | "diverged";
