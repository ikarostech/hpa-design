import type {
  InspectorController,
  Job,
  JobController,
  MultiSelection,
  ResultViewController,
} from "@/shared/model";
import type { AirfoilPolar } from "./types";
import type { XfoilAnalysisSettings } from "./xfoilAnalysis";

export type AirfoilEditorMode = "create-naca" | "import-dat" | "edit";

export type AirfoilAnalysisJob = Job<string, AirfoilPolar[], XfoilAnalysisSettings> & {
  kind: "airfoil-analysis";
  targetAirfoilIds: readonly string[];
  runId?: string;
};

export type AirfoilAnalysisJobController = JobController<XfoilAnalysisSettings, AirfoilAnalysisJob>;

export interface AirfoilWorkspaceSelection {
  detailInspector: InspectorController<string>;
  analysisTargets: MultiSelection<string>;
  displayedRuns: ResultViewController<string>;
}
