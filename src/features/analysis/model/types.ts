import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AerodynamicSpanDistribution } from "./spanwiseDistribution";

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
  surfaceLoads?: Array<{ surfaceId: string; cl: number; cy: number; cm: number; cr: number; cn: number }>;
  ld: number;
  status: AnalysisCaseStatus;
  spanwise?: AerodynamicSpanDistribution;
}
