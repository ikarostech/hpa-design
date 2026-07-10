import { useMemo, useState } from "react";
import type { InspectorController, InspectorState, ResultViewController } from "@/shared/model";
import { useJobs } from "@/shared/jobs/JobProvider";
import { buildAirfoilChartSeries } from "../model/chartSeries";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../model/types";
import type {
  AirfoilAnalysisJob,
  AirfoilAnalysisJobController,
  AirfoilEditorMode,
  AirfoilWorkspaceSelection,
} from "../model/workspace";
import { runXfoilAnalysis, type XfoilAnalysisSettings } from "../model/xfoilAnalysis";
import { airfoilPolars, airfoils, polarPoints } from "../../../mocks/mockData";

const initialAnalysisRuns: AirfoilAnalysisRun[] = [
  {
    id: "run-initial-polars",
    name: "初期Polar比較",
    airfoilIds: Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))),
    polarIds: airfoilPolars.map((polar) => polar.id),
    createdAt: "サンプルデータ",
    reynolds: 300000,
    mach: 0.04,
    alphaRange: "-6° to 18°",
    status: "完了",
  },
];

const initialDetailState: InspectorState<string> = {
  open: false,
  mode: "detail",
  targetId: airfoils[0]?.id ?? null,
};

const initialAnalysisDrawerState: InspectorState<string> = {
  open: false,
  mode: "create",
  targetId: null,
};

export function useAirfoilWorkspace() {
  const jobs = useJobs();
  const [airfoilItems, setAirfoilItems] = useState<Airfoil[]>(airfoils);
  const [detailState, setDetailState] = useState<InspectorState<string>>(initialDetailState);
  const [editorMode, setEditorMode] = useState<AirfoilEditorMode | null>(null);
  const [analysisDrawerState, setAnalysisDrawerState] = useState<InspectorState<string>>(initialAnalysisDrawerState);
  const [generatedPolars, setGeneratedPolars] = useState<AirfoilPolar[]>([]);
  const [analysisRuns, setAnalysisRuns] = useState<AirfoilAnalysisRun[]>(initialAnalysisRuns);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialAnalysisRuns[0]?.id ?? null);
  const [analysisTargetIds, setAnalysisTargetIds] = useState<string[]>(() => [airfoils[0].id, airfoils[1].id]);
  const analysisJobs = jobs.jobs.filter((job): job is AirfoilAnalysisJob => job.kind === "airfoil-analysis");

  const allPolars = useMemo(() => [...airfoilPolars, ...generatedPolars], [generatedPolars]);
  const selected = airfoilItems.find((airfoil) => airfoil.id === detailState.targetId) ?? airfoilItems[0];
  const selectedRun = analysisRuns.find((run) => run.id === selectedRunId) ?? analysisRuns[0];
  const selectedRunPolars = useMemo(
    () => allPolars.filter((polar) => selectedRun.polarIds.includes(polar.id)),
    [allPolars, selectedRun.polarIds],
  );
  const selectedTargetNames = useMemo(
    () => analysisTargetIds
      .map((id) => airfoilItems.find((airfoil) => airfoil.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
    [airfoilItems, analysisTargetIds],
  );
  const selectedHasPolar = allPolars.some((polar) => polar.airfoilId === selected.id);
  const chartSeries = useMemo(
    () => buildAirfoilChartSeries(selectedRunPolars, airfoilItems),
    [airfoilItems, selectedRunPolars],
  );

  const detailInspector: InspectorController<string> = {
    state: detailState,
    openDetail: (id) => setDetailState({ open: true, mode: "detail", targetId: id }),
    openCreate: () => setDetailState({ open: true, mode: "create", targetId: null }),
    openEdit: (id) => setDetailState({ open: true, mode: "edit", targetId: id }),
    close: () => setDetailState((current) => ({ ...current, open: false })),
  };

  const analysisTargets = {
    selectedIds: analysisTargetIds,
    isSelected: (id: string) => analysisTargetIds.includes(id),
    toggle: (id: string) => setAnalysisTargetIds((current) => current.includes(id)
      ? current.filter((currentId) => currentId !== id)
      : [...current, id]),
    replace: (ids: readonly string[]) => setAnalysisTargetIds([...ids]),
    clear: () => setAnalysisTargetIds([]),
  };

  const displayedRuns: ResultViewController<string> = {
    state: {
      displayedResultIds: selectedRunId ? [selectedRunId] : [],
      primaryResultId: selectedRunId,
      compareMode: false,
    },
    show: setSelectedRunId,
    hide: (id) => setSelectedRunId((current) => current === id ? null : current),
    setPrimary: setSelectedRunId,
    clear: () => setSelectedRunId(null),
  };

  const selection: AirfoilWorkspaceSelection = {
    detailInspector,
    analysisTargets,
    displayedRuns,
  };

  const openEditor = (mode: AirfoilEditorMode, airfoilId?: string) => {
    if (airfoilId) {
      setDetailState({ open: false, mode: "detail", targetId: airfoilId });
    } else {
      detailInspector.close();
    }
    setEditorMode(mode);
  };

  const saveAirfoil = (airfoil: Airfoil) => {
    setAirfoilItems((current) => {
      const exists = current.some((item) => item.id === airfoil.id);
      return exists ? current.map((item) => item.id === airfoil.id ? airfoil : item) : [airfoil, ...current];
    });
    setDetailState({ open: false, mode: "detail", targetId: airfoil.id });
    setEditorMode(null);
  };

  const runAnalysis = async (settings: XfoilAnalysisSettings) => {
    const targets = airfoilItems.filter((airfoil) => analysisTargetIds.includes(airfoil.id));
    const jobId = `job-airfoil-analysis-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const runningJob = jobs.createJob<AirfoilAnalysisJob>({
      id: jobId,
      kind: "airfoil-analysis",
      name: "2D翼型解析",
      status: "running",
      createdAt: startedAt,
      startedAt,
      progress: { completed: 0, total: targets.length },
      settings,
      targetAirfoilIds: targets.map((airfoil) => airfoil.id),
    });

    try {
      const polars: AirfoilPolar[] = [];

      for (const airfoil of targets) {
        polars.push(await runXfoilAnalysis(airfoil, settings));
        jobs.updateJob<AirfoilAnalysisJob>(jobId, { progress: { completed: polars.length, total: targets.length } });
      }

      const runId = `run-${Date.now()}`;
      const run: AirfoilAnalysisRun = {
        id: runId,
        name: `一括解析 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`,
        airfoilIds: targets.map((airfoil) => airfoil.id),
        polarIds: polars.map((polar) => polar.id),
        createdAt: new Date().toLocaleString("ja-JP"),
        reynolds: settings.reynolds,
        mach: settings.mach,
        alphaRange: `${settings.alphaStart}° to ${settings.alphaEnd}°`,
        status: "完了",
      };
      const completedJob: AirfoilAnalysisJob = {
        ...runningJob,
        status: "completed",
        finishedAt: new Date().toISOString(),
        progress: { completed: targets.length, total: targets.length },
        result: polars,
        runId,
      };

      setGeneratedPolars((current) => [...polars, ...current]);
      setAnalysisRuns((current) => [run, ...current]);
      setSelectedRunId(runId);
      jobs.completeJob<AirfoilAnalysisJob>(jobId, completedJob);
      setAnalysisDrawerState((current) => ({ ...current, open: false }));
      return completedJob;
    } catch (error) {
      const failedJob: AirfoilAnalysisJob = {
        ...runningJob,
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : "XFOIL解析に失敗しました。",
      };
      jobs.failJob(jobId, failedJob.errorMessage ?? "XFOIL解析に失敗しました。");
      return failedJob;
    }
  };

  const analysisJobController: AirfoilAnalysisJobController = {
    jobs: analysisJobs,
    currentJob: analysisJobs.find((job) => job.status === "running") ?? analysisJobs[0] ?? null,
    run: runAnalysis,
    cancel: async (jobId) => {
      jobs.cancelJob(jobId);
    },
    clearCompleted: jobs.clearCompleted,
  };

  return {
    airfoils: airfoilItems,
    polars: allPolars,
    polarPoints,
    selected,
    selectedRun,
    selectedTargetNames,
    selectedHasPolar,
    chartSeries,
    analysisRuns,
    analysisDrawerState,
    editorMode,
    selection,
    analysisJobController,
    openAnalysisDrawer: () => setAnalysisDrawerState({ open: true, mode: "create", targetId: null }),
    closeAnalysisDrawer: () => setAnalysisDrawerState((current) => ({ ...current, open: false })),
    openEditor,
    closeEditor: () => setEditorMode(null),
    saveAirfoil,
  };
}
