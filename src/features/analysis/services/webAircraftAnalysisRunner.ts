import type { JobProgress } from "../../../shared/model";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import type { AnalysisCase, AnalysisResult } from "../model/types";
import { AnalysisExecutionCancelledError } from "./analysisExecutionService";

export interface AircraftAnalysisInput {
  analysisCase: AnalysisCase;
  aircraft: AircraftGeometry;
  polarIds?: readonly string[];
  polars?: readonly AirfoilPolar[];
  resultId: string;
}

export interface AircraftAnalysisRunner {
  run: (input: AircraftAnalysisInput, signal: AbortSignal, onProgress: (progress: JobProgress) => void) => Promise<AnalysisResult>;
}

type WorkerResponse =
  | { type: "progress"; progress: JobProgress }
  | { type: "success"; result: AnalysisResult }
  | { type: "failure"; message: string };

export const webAircraftAnalysisRunner: AircraftAnalysisRunner = {
  run: (input, signal, onProgress) => runInWorker(input, signal, onProgress),
};

function runInWorker(input: AircraftAnalysisInput, signal: AbortSignal, onProgress: (progress: JobProgress) => void) {
  if (signal.aborted) return Promise.reject(new AnalysisExecutionCancelledError());
  if (typeof Worker !== "function") return Promise.reject(new Error("このブラウザでは空力解析をバックグラウンド実行できません。"));

  return new Promise<AnalysisResult>((resolve, reject) => {
    const worker = new Worker(new URL("./aircraftAnalysis.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => signal.removeEventListener("abort", abort);
    const finish = () => { cleanup(); worker.terminate(); };
    const abort = () => { finish(); reject(new AnalysisExecutionCancelledError()); };

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
      reject(new Error(`空力解析Workerの実行に失敗しました: ${event.message}`));
    }, { once: true });
    worker.postMessage({ type: "run", input });
  });
}
