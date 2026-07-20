import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../model/types";
import type { XfoilAnalysisSettings } from "../model/analysis";

export interface AirfoilAnalysisRunner {
  run: (airfoil: Airfoil, settings: XfoilAnalysisSettings, signal: AbortSignal) => Promise<AirfoilPolar>;
}

export interface ExecuteAirfoilAnalysisInput {
  targets: readonly Airfoil[];
  settings: XfoilAnalysisSettings;
  runner: AirfoilAnalysisRunner;
  signal?: AbortSignal;
  createId: (prefix: "run") => string;
  now: () => Date;
  onProgress: (progress: { completed: number; total: number }) => void;
}

export interface AirfoilAnalysisExecution {
  run: AirfoilAnalysisRun;
  polars: readonly AirfoilPolar[];
}

export class AirfoilAnalysisCancelledError extends Error {
  readonly execution: AirfoilAnalysisExecution;

  constructor(execution: AirfoilAnalysisExecution = emptyCancelledExecution()) {
    super("Airfoil analysis was cancelled.");
    this.name = "AirfoilAnalysisCancelledError";
    this.execution = execution;
  }
}

function emptyCancelledExecution(): AirfoilAnalysisExecution {
  return {
    polars: [],
    run: { id: "cancelled", name: "Cancelled analysis", airfoilIds: [], polarIds: [], createdAt: new Date(0).toISOString(), reynolds: 0, mach: 0, alphaStart: 0, alphaEnd: 0, alphaStep: 0, status: "needs-review", failures: [] },
  };
}

export async function executeAirfoilAnalysis({
  targets,
  settings,
  runner,
  signal = new AbortController().signal,
  createId,
  now,
  onProgress,
}: ExecuteAirfoilAnalysisInput): Promise<AirfoilAnalysisExecution> {
  const polars: AirfoilPolar[] = [];
  const failures: Array<{ airfoilId: string; message: string }> = [];

  for (let index = 0; index < targets.length; index += 1) {
    const airfoil = targets[index];
    if (signal.aborted) {
      throw new AirfoilAnalysisCancelledError(createExecution(targets, settings, polars, [...failures, ...targets.slice(index).map((target) => ({ airfoilId: target.id, message: "Cancelled" }))], createId, now));
    }
    let polar: AirfoilPolar;
    try {
      polar = await runner.run(airfoil, settings, signal);
    } catch (error) {
      if (signal.aborted) {
        throw new AirfoilAnalysisCancelledError(createExecution(targets, settings, polars, [...failures, ...targets.slice(index).map((target) => ({ airfoilId: target.id, message: "Cancelled" }))], createId, now));
      }
      failures.push({ airfoilId: airfoil.id, message: error instanceof Error ? error.message : "XFOIL解析に失敗しました。" });
      onProgress({ completed: polars.length + failures.length, total: targets.length });
      continue;
    }
    polars.push(polar);
    onProgress({ completed: polars.length, total: targets.length });
  }

  return createExecution(targets, settings, polars, failures, createId, now);
}

function createExecution(
  targets: readonly Airfoil[],
  settings: XfoilAnalysisSettings,
  polars: readonly AirfoilPolar[],
  failures: readonly { airfoilId: string; message: string }[],
  createId: (prefix: "run") => string,
  now: () => Date,
): AirfoilAnalysisExecution {
  const createdAt = now().toISOString();
  return {
    polars,
    run: {
      id: createId("run"),
      name: `一括解析 ${new Date(createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`,
      airfoilIds: targets.map((airfoil) => airfoil.id),
      polarIds: polars.map((polar) => polar.id),
      createdAt,
      reynolds: settings.reynolds,
      mach: settings.mach,
      alphaStart: settings.alphaStart,
      alphaEnd: settings.alphaEnd,
      alphaStep: settings.alphaStep,
      ncrit: settings.ncrit,
      iterations: settings.iterations,
      status: failures.length ? "needs-review" : "complete",
      failures: failures.length ? [...failures] : undefined,
    },
  };
}
