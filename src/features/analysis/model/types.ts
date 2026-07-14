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
  rows: Array<{ caseId: string; alpha: number; cl: number; cd: number; cm: number; ld: number; status: AnalysisCaseStatus }>;
}
