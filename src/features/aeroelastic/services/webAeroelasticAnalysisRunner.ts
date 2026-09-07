import type { JobProgress } from "../../../shared/model";
import type { StaticAeroelasticResult, executeStaticAeroelasticAnalysis } from "./staticAeroelasticSolver";

export type AeroelasticAnalysisInput = Omit<Parameters<typeof executeStaticAeroelasticAnalysis>[0], "onProgress">;

export interface AeroelasticAnalysisRunner {
  run: (input: AeroelasticAnalysisInput, signal: AbortSignal, onProgress: (progress: JobProgress) => void) => Promise<StaticAeroelasticResult>;
}

export class AeroelasticAnalysisCancelledError extends Error {
  constructor() {
    super("Aeroelastic analysis was cancelled.");
    this.name = "AeroelasticAnalysisCancelledError";
  }
}

type WorkerResponse =
  | { type: "progress"; progress: JobProgress }
  | { type: "success"; result: StaticAeroelasticResult }
  | { type: "failure"; message: string };

export const webAeroelasticAnalysisRunner: AeroelasticAnalysisRunner = {
  run: (input, signal, onProgress) => runInWorker(input, signal, onProgress),
};

function runInWorker(input: AeroelasticAnalysisInput, signal: AbortSignal, onProgress: (progress: JobProgress) => void) {
  if (signal.aborted) return Promise.reject(new AeroelasticAnalysisCancelledError());
  if (typeof Worker !== "function") return Promise.reject(new Error("このブラウザでは連成解析をバックグラウンド実行できません。"));

  return new Promise<StaticAeroelasticResult>((resolve, reject) => {
    const worker = new Worker(new URL("./aeroelasticAnalysis.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => signal.removeEventListener("abort", abort);
    const finish = () => { cleanup(); worker.terminate(); };
    const abort = () => { finish(); reject(new AeroelasticAnalysisCancelledError()); };

    signal.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      if (event.data.type === "progress") {
        onProgress(event.data.progress);
        return;
      }
      finish();
      if (event.data.type === "success") resolve(event.data.result);
      else reject(new Error(event.data.message));
    });
    worker.addEventListener("error", (event) => {
      finish();
      reject(new Error(`連成解析Workerの実行に失敗しました: ${event.message}`));
    }, { once: true });
    worker.postMessage({ type: "run", input });
  });
}
