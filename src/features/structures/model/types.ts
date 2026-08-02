export type PlyAngle = 0 | 45 | -45 | 90;
export type StructuralStatus = "completed" | "not-run" | "needs-review";
export type StructuralLoadSource = "aerodynamic" | "elliptical" | "manual";

export interface CarbonMaterial {
  id: string;
  name: string;
  e1: number;
  e2: number;
  g12: number;
  nu12: number;
  tensileStrength1: number;
  compressiveStrength1: number;
  tensileStrength2: number;
  compressiveStrength2: number;
  shearStrength12: number;
  density: number;
  plyThickness: number;
  reductionFactor: number;
  note?: string;
}

export interface LaminatePly {
  id: string;
  materialId: string;
  angle: PlyAngle;
  count: number;
}

export interface StructuralTubeSection {
  id: string;
  length: number;
  outerDiameter: number;
  plies: LaminatePly[];
}

export interface DistributedStructuralLoad {
  yPosition: number;
  liftPerLength: number;
  torquePerLength: number;
}

export interface StructuralPointLoad {
  id: string;
  yPosition: number;
  force: number;
  torque: number;
}

export interface StructuralLoadCase {
  id: string;
  name: string;
  source: StructuralLoadSource;
  aerodynamicResultId?: string;
  loadFactor: number;
  safetyFactor: number;
  distributedLoads: DistributedStructuralLoad[];
  pointLoads: StructuralPointLoad[];
  status: StructuralStatus;
}

export interface StructuralDesign {
  id: string;
  name: string;
  sections: StructuralTubeSection[];
  loadCases: StructuralLoadCase[];
  supports?: Array<{ id: string; yPosition: number; kind: "rigid" | "elastic"; stiffness?: number }>;
}

export interface StructuralResultPoint {
  yPosition: number;
  distributedLoad: number;
  shearForce: number;
  bendingMoment: number;
  torque: number;
  deflection: number;
  rotation: number;
  twist: number;
  outerDiameter: number;
  thickness: number;
  ei: number;
  gj: number;
  linearMass: number;
  axialStress: number;
  shearStress: number;
  minReserveFactor: number;
  criticalPlyId: string;
  criticalMode: string;
}

export interface StructuralAnalysisResult {
  id: string;
  designId: string;
  loadCaseId: string;
  status: StructuralStatus;
  createdAt: string;
  designSnapshot: StructuralDesign;
  loadCaseSnapshot: StructuralLoadCase;
  materialIds: string[];
  materialSnapshots?: CarbonMaterial[];
  points: StructuralResultPoint[];
  summary: {
    mass: number;
    maxDeflection: number;
    maxTwist: number;
    minReserveFactor: number;
    governingLoadCase: string;
    governingPosition: number;
    governingPlyId: string;
    governingMode: string;
    reactionForce: number;
    reactionMoment: number;
    forceBalanceError: number;
    momentBalanceError?: number;
    supportReactions?: Array<{ supportId: string; yPosition: number; force: number }>;
  };
}
