import type { StructuralAnalysisResult } from "../model/types";
import type { executeStructuralAnalysis } from "./structuralAnalysis";

export type StructuralAnalysisInput = Parameters<typeof executeStructuralAnalysis>[0];

export interface StructuralAnalysisRunner {
  run: (input: StructuralAnalysisInput, signal: AbortSignal) => Promise<StructuralAnalysisResult>;
}

export class StructuralAnalysisCancelledError extends Error {
  constructor() {
    super("Structural analysis was cancelled.");
    this.name = "StructuralAnalysisCancelledError";
  }
}

type WorkerResponse =
  | { type: "success"; result: StructuralAnalysisResult }
  | { type: "failure"; message: string };

export const webStructuralAnalysisRunner: StructuralAnalysisRunner = {
  run: (input, signal) => runInWorker(input, signal),
};

function runInWorker(input: StructuralAnalysisInput, signal: AbortSignal): Promise<StructuralAnalysisResult> {
  if (signal.aborted) return Promise.reject(new StructuralAnalysisCancelledError());
  if (typeof Worker !== "function") return Promise.reject(new Error("このブラウザでは構造解析をバックグラウンド実行できません。"));

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./structuralAnalysis.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => signal.removeEventListener("abort", abort);
    const finish = () => { cleanup(); worker.terminate(); };
    const abort = () => { finish(); reject(new StructuralAnalysisCancelledError()); };

    signal.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      finish();
      if (event.data.type === "success") resolve(event.data.result);
      else reject(new Error(event.data.message));
    }, { once: true });
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(`構造解析Workerの実行に失敗しました: ${event.message}`));
    }, { once: true });
    worker.postMessage({ type: "run", input });
  });
}
