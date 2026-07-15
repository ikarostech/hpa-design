import type {
  InspectorController,
  Job,
  JobController,
  MultiSelection,
  EntityRepository,
  ResultViewController,
} from "@/shared/model";
import type { XfoilAnalysisSettings } from "./analysis";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "./types";

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

export interface AirfoilWorkspaceData {
  airfoils: readonly Airfoil[];
  polars: readonly AirfoilPolar[];
  analysisRuns: readonly AirfoilAnalysisRun[];
  airfoilRepository: EntityRepository<Airfoil, string>;
  getAirfoilReferences: (airfoilId: string) => readonly string[];
  saveAnalysis: (run: AirfoilAnalysisRun, polars: readonly AirfoilPolar[]) => void;
}
