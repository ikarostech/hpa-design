import { useMemo, useRef, useState } from "react";
import type { InspectorController, InspectorState, ResultViewController } from "@/shared/model";
import { useJobs } from "@/shared/jobs/JobProvider";
import { buildAirfoilChartSeries } from "../model/chartSeries";
import type { Airfoil, AirfoilAnalysisRun } from "../model/types";
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
  const maxComparisonRuns = 6;
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
  const [displayedRunIds, setDisplayedRunIds] = useState<string[]>(() => data.analysisRuns[0] ? [data.analysisRuns[0].id] : []);
  const [analysisTargetIds, setAnalysisTargetIds] = useState<string[]>(() => data.airfoils.slice(0, 2).map((airfoil) => airfoil.id));
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [drawerSettings, setDrawerSettings] = useState<XfoilAnalysisSettings | undefined>(undefined);
  const analysisJobs = jobs.jobs.filter((job): job is AirfoilAnalysisJob => job.kind === "airfoil-analysis");

  const allPolars = data.polars;
  const selected = data.airfoils.find((airfoil) => airfoil.id === detailState.targetId) ?? data.airfoils[0];
  const selectedRun = data.analysisRuns.find((run) => run.id === selectedRunId) ?? data.analysisRuns[0];
  const selectedRunPolars = useMemo(
    () => allPolars.filter((polar) => displayedRunIds.some((runId) => data.analysisRuns.find((run) => run.id === runId)?.polarIds.includes(polar.id))),
    [allPolars, data.analysisRuns, displayedRunIds],
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
      displayedResultIds: displayedRunIds,
      primaryResultId: selectedRunId,
      compareMode: displayedRunIds.length > 1,
    },
    show: (id) => setDisplayedRunIds((current) => current.includes(id) || current.length >= maxComparisonRuns ? current : [...current, id]),
    hide: (id) => setDisplayedRunIds((current) => current.filter((currentId) => currentId !== id)),
    setPrimary: (id) => { setSelectedRunId(id); setDisplayedRunIds((current) => current.includes(id) ? current : [...current, id]); },
    clear: () => { setSelectedRunId(null); setDisplayedRunIds([]); },
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

  const removeAirfoil = async (airfoilId: string) => {
    try {
      await data.airfoilRepository.remove(airfoilId);
      setRemovalError(null);
      detailInspector.close();
      return true;
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : "翼型を削除できませんでした。");
      return false;
    }
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
        status: execution.polars.length ? "completed" : "failed",
        finishedAt: new Date().toISOString(),
        progress: { completed: execution.polars.length, total: targets.length },
        result: [...execution.polars],
        runId: execution.run.id,
      };

      data.saveAnalysis(execution.run, execution.polars);
      setSelectedRunId(execution.run.id);
      setDisplayedRunIds([execution.run.id]);
      if (execution.polars.length) {
        jobs.completeJob<AirfoilAnalysisJob>(jobId, completedJob);
      } else {
        jobs.updateJob<AirfoilAnalysisJob>(jobId, { result: [...execution.polars], runId: execution.run.id });
        jobs.failJob(jobId, execution.run.failures?.map((failure) => failure.message).join(" / ") || "No polar was produced.");
      }
      setAnalysisDrawerState((current) => ({ ...current, open: false }));
      return completedJob;
    } catch (error) {
      if (error instanceof AirfoilAnalysisCancelledError) {
        if (error.execution.polars.length) {
          data.saveAnalysis(error.execution.run, error.execution.polars);
          setSelectedRunId(error.execution.run.id);
          setDisplayedRunIds([error.execution.run.id]);
          jobs.updateJob<AirfoilAnalysisJob>(jobId, { result: [...error.execution.polars], runId: error.execution.run.id });
        }
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
    drawerSettings,
    editorMode,
    selection,
    analysisJobController,
    openAnalysisDrawer: () => { setDrawerSettings(undefined); setAnalysisDrawerState({ open: true, mode: "create", targetId: null }); },
    retryFailedRun: (run: AirfoilAnalysisRun) => {
      const failedIds = run.failures?.map((failure) => failure.airfoilId) ?? [];
      if (!failedIds.length) return;
      setAnalysisTargetIds(failedIds);
      setDrawerSettings({ reynolds: run.reynolds, mach: run.mach, alphaStart: run.alphaStart, alphaEnd: run.alphaEnd, alphaStep: run.alphaStep, ncrit: run.ncrit ?? 9, iterations: run.iterations ?? 100 });
      setAnalysisDrawerState({ open: true, mode: "create", targetId: null });
    },
    removeAnalysisRun: data.removeAnalysisRun,
    renameAnalysisRun: (run: AirfoilAnalysisRun, name: string) => data.updateAnalysisRun({ ...run, name: name.trim() || run.name }),
    duplicateAnalysisRun: (run: AirfoilAnalysisRun) => {
      setAnalysisTargetIds(run.airfoilIds);
      setDrawerSettings({ reynolds: run.reynolds, mach: run.mach, alphaStart: run.alphaStart, alphaEnd: run.alphaEnd, alphaStep: run.alphaStep, ncrit: run.ncrit ?? 9, iterations: run.iterations ?? 100 });
      setAnalysisDrawerState({ open: true, mode: "create", targetId: null });
    },
    comparisonLimitReached: displayedRunIds.length >= maxComparisonRuns,
    maxComparisonRuns,
    closeAnalysisDrawer: () => setAnalysisDrawerState((current) => ({ ...current, open: false })),
    openEditor,
    closeEditor: () => setEditorMode(null),
    saveAirfoil,
    removeAirfoil,
    removalError,
    clearRemovalError: () => setRemovalError(null),
    referencesForAirfoil: data.getAirfoilReferences,
    compareAllRuns: () => {
      const ids = data.analysisRuns.map((run) => run.id);
      setDisplayedRunIds(ids);
      setSelectedRunId(ids[0] ?? null);
    },
  };
}
