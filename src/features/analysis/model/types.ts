import type { RunStatus } from "../../airfoils/model/types";

export type AnalysisMethod = "LLT" | "VLM";

export interface AnalysisCase {
  id: string;
  name: string;
  method: AnalysisMethod;
  alphaSweep: string;
  speed: number;
  altitude: number;
  reynolds: number;
  geometry: string;
  status: RunStatus;
}

export interface AnalysisResult {
  id: string;
  caseId: string;
  clMax: number;
  cdMin: number;
  maxLD: number;
  cm0: number;
  status: RunStatus;
  rows: Array<{ caseName: string; alpha: number; cl: number; cd: number; cm: number; ld: number; status: RunStatus }>;
}
