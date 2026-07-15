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
  constructor() {
    super("Airfoil analysis was cancelled.");
    this.name = "AirfoilAnalysisCancelledError";
  }
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
  throwIfCancelled(signal);
  const polars: AirfoilPolar[] = [];
  const failures: Array<{ airfoilId: string; message: string }> = [];

  for (const airfoil of targets) {
    throwIfCancelled(signal);
    let polar: AirfoilPolar;
    try {
      polar = await runner.run(airfoil, settings, signal);
    } catch (error) {
      throwIfCancelled(signal);
      failures.push({ airfoilId: airfoil.id, message: error instanceof Error ? error.message : "XFOIL解析に失敗しました。" });
      onProgress({ completed: polars.length + failures.length, total: targets.length });
      continue;
    }
    throwIfCancelled(signal);
    polars.push(polar);
    onProgress({ completed: polars.length, total: targets.length });
  }

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
      status: failures.length ? "needs-review" : "complete",
      failures: failures.length ? failures : undefined,
    },
  };
}

function throwIfCancelled(signal: AbortSignal) {
  if (signal.aborted) {
    throw new AirfoilAnalysisCancelledError();
  }
}
