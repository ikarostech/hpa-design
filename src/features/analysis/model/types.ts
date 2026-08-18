import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AerodynamicSpanDistribution } from "./spanwiseDistribution";

export type AnalysisMethod = "LLT" | "VLM";
export type AnalysisCaseStatus = "completed" | "not-run" | "needs-review";

export interface AnalysisCase {
  id: string;
  name: string;
  method: AnalysisMethod;
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
  ld: number;
  status: AnalysisCaseStatus;
  spanwise?: AerodynamicSpanDistribution;
}
