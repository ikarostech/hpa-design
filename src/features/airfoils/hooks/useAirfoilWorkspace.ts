import { useMemo, useRef, useState } from "react";
import type { InspectorController, InspectorState, ResultViewController } from "@/shared/model";
import { useJobs } from "@/shared/jobs/JobProvider";
import { buildAirfoilChartSeries } from "../model/chartSeries";
import type { Airfoil } from "../model/types";
import type {
  AirfoilAnalysisJob,
  AirfoilAnalysisJobController,
  AirfoilEditorMode,
  AirfoilWorkspaceData,
  AirfoilWorkspaceSelection,
} from "../model/workspace";
import type { XfoilAnalysisSettings } from "../model/analysis";
import {
  AirfoilAnalysisCancelledError,
  executeAirfoilAnalysis,
  type AirfoilAnalysisRunner,
} from "../services/airfoilAnalysisService";
import { webXfoilAnalysisRunner } from "../services/webXfoilAnalysisRunner";

export function useAirfoilWorkspace(
  data: AirfoilWorkspaceData,
  runner: AirfoilAnalysisRunner = webXfoilAnalysisRunner,
) {
  const jobs = useJobs();
  const controllers = useRef(new Map<string, AbortController>());
  const [detailState, setDetailState] = useState<InspectorState<string>>(() => ({
    open: false,
    mode: "detail",
    targetId: data.airfoils[0]?.id ?? null,
  }));
  const [editorMode, setEditorMode] = useState<AirfoilEditorMode | null>(null);
  const [analysisDrawerState, setAnalysisDrawerState] = useState<InspectorState<string>>({ open: false, mode: "create", targetId: null });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => data.analysisRuns[0]?.id ?? null);
  const [analysisTargetIds, setAnalysisTargetIds] = useState<string[]>(() => data.airfoils.slice(0, 2).map((airfoil) => airfoil.id));
  const analysisJobs = jobs.jobs.filter((job): job is AirfoilAnalysisJob => job.kind === "airfoil-analysis");

  const allPolars = data.polars;
  const selected = data.airfoils.find((airfoil) => airfoil.id === detailState.targetId) ?? data.airfoils[0];
  const selectedRun = data.analysisRuns.find((run) => run.id === selectedRunId) ?? data.analysisRuns[0];
  const selectedRunPolars = useMemo(
    () => selectedRun ? allPolars.filter((polar) => selectedRun.polarIds.includes(polar.id)) : [],
    [allPolars, selectedRun],
  );
  const selectedTargetNames = useMemo(
    () => analysisTargetIds
      .map((id) => data.airfoils.find((airfoil) => airfoil.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
    [data.airfoils, analysisTargetIds],
  );
  const selectedHasPolar = selected ? allPolars.some((polar) => polar.airfoilId === selected.id) : false;
  const chartSeries = useMemo(
    () => buildAirfoilChartSeries(selectedRunPolars, [...data.airfoils]),
    [data.airfoils, selectedRunPolars],
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
    void data.airfoilRepository.save(airfoil);
    setDetailState({ open: false, mode: "detail", targetId: airfoil.id });
    setEditorMode(null);
  };

  const runAnalysis = async (settings: XfoilAnalysisSettings) => {
    const targets = data.airfoils.filter((airfoil) => analysisTargetIds.includes(airfoil.id));
    const jobId = `job-airfoil-analysis-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const controller = new AbortController();
    controllers.current.set(jobId, controller);
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
      const execution = await executeAirfoilAnalysis({
        targets,
        settings,
        runner,
        signal: controller.signal,
        createId: (prefix) => `${prefix}-${Date.now()}`,
        now: () => new Date(),
        onProgress: (progress) => jobs.updateJob<AirfoilAnalysisJob>(jobId, { progress }),
      });
      const completedJob: AirfoilAnalysisJob = {
        ...runningJob,
        status: "completed",
        finishedAt: new Date().toISOString(),
        progress: { completed: execution.polars.length, total: targets.length },
        result: [...execution.polars],
        runId: execution.run.id,
      };

      data.saveAnalysis(execution.run, execution.polars);
      setSelectedRunId(execution.run.id);
      jobs.completeJob<AirfoilAnalysisJob>(jobId, completedJob);
      setAnalysisDrawerState((current) => ({ ...current, open: false }));
      return completedJob;
    } catch (error) {
      if (error instanceof AirfoilAnalysisCancelledError) {
        jobs.cancelJob(jobId);
        return { ...runningJob, status: "cancelled" as const, finishedAt: new Date().toISOString() };
      }
      const failedJob: AirfoilAnalysisJob = {
        ...runningJob,
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : "XFOIL解析に失敗しました。",
      };
      jobs.failJob(jobId, failedJob.errorMessage ?? "XFOIL解析に失敗しました。");
      return failedJob;
    } finally {
      controllers.current.delete(jobId);
    }
  };

  const analysisJobController: AirfoilAnalysisJobController = {
    jobs: analysisJobs,
    currentJob: analysisJobs.find((job) => job.status === "running") ?? analysisJobs[0] ?? null,
    run: runAnalysis,
    cancel: async (jobId) => {
      controllers.current.get(jobId)?.abort();
      jobs.cancelJob(jobId);
    },
    clearCompleted: () => jobs.clearCompleted("airfoil-analysis"),
  };

  return {
    airfoils: data.airfoils,
    polars: allPolars,
    polarPoints: allPolars[0]?.points ?? [],
    selected,
    selectedRun,
    selectedTargetNames,
    selectedHasPolar,
    chartSeries,
    analysisRuns: data.analysisRuns,
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
