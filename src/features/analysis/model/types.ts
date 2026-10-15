import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AerodynamicSpanDistribution } from "./spanwiseDistribution";
import type { WingAnalysisMesh } from "../services/wingAnalysisMesh";

export interface StabilityDeformationPoint {
  yPosition: number;
  deflection: number;
  twist: number;
}

export type StabilityShape = { kind: "rigid" } | {
  kind: "manual";
  elasticAxisChordFraction: number;
  points: StabilityDeformationPoint[];
} | {
  kind: "fsi";
  resultId: string;
  createdAt: string;
  speed: number;
  alphaDegrees: number;
  aircraftSnapshot: AircraftGeometry;
  /** Frozen mesh before applying main-wing incidence, as stored by FSI. */
  wingMesh: WingAnalysisMesh;
};

export type AnalysisMethod = "LLT" | "VLM";
export type AnalysisCaseStatus = "completed" | "not-run" | "needs-review";

export interface AnalysisCase {
  id: string;
  name: string;
  method: AnalysisMethod;
  /** Older cases default to wing-only analysis. */
  scope?: "wing" | "aircraft";
  /** Sideslip in degrees; only used by whole-aircraft VLM. */
  beta?: number;
  /** Longitudinal center-of-gravity position aft of the wing root leading edge, m. */
  cgX?: number;
  /** Vertical center-of-gravity position above the wing root, m; Y is assumed zero. */
  cgZ?: number;
  /** Omitted legacy cases use the rigid shape. */
  stabilityShape?: StabilityShape;
  alphaStart: number;
  alphaEnd: number;
  alphaStep: number;
  speed: number;
  altitude: number;
  reynolds: number;
  geometryId: string;
  status: AnalysisCaseStatus;
}

export interface AnalysisResult {
  id: string;
  caseId: string;
  clMax: number;
  cdMin: number;
  maxLD: number;
  cm0: number;
  status: AnalysisCaseStatus;
  caseSnapshot?: AnalysisCase;
  aircraftSnapshot?: AircraftGeometry;
  airfoilIds?: readonly string[];
  polarIds?: readonly string[];
  rows: AnalysisResultRow[];
}

export interface AnalysisResultRow {
  caseId: string;
  alpha: number;
  cl: number;
  cd: number;
  cm: number;
  cy?: number;
  cr?: number;
  cn?: number;
  cdi?: number;
  cgX?: number;
  cgZ?: number;
  /** dCn/dBeta, per radian, from a central VLM difference. */
  cnBeta?: number;
  /** dCr/dBeta about the aft-pointing X axis, per radian (dihedral effect). */
  crBeta?: number;
  /** dCY/dBeta in aircraft axes, per radian. */
  cyBeta?: number;
  surfaceLoads?: Array<{ surfaceId: string; cl: number; cy: number; cm: number; cr: number; cn: number }>;
  ld: number;
  status: AnalysisCaseStatus;
  spanwise?: AerodynamicSpanDistribution;
}
