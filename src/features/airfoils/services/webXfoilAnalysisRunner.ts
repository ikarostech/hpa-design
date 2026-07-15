import type { XfoilAnalysisSettings } from "../model/analysis";
import type { Airfoil, AirfoilPolar } from "../model/types";
import { AirfoilAnalysisCancelledError, type AirfoilAnalysisRunner } from "./airfoilAnalysisService";

interface WorkerSuccess {
  type: "success";
  polar: AirfoilPolar;
}

interface WorkerFailure {
  type: "failure";
  message: string;
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

export const webXfoilAnalysisRunner: AirfoilAnalysisRunner = {
  run: (airfoil, settings, signal) => runInWorker(airfoil, settings, signal),
};

function runInWorker(airfoil: Airfoil, settings: XfoilAnalysisSettings, signal: AbortSignal): Promise<AirfoilPolar> {
  if (signal.aborted) {
    return Promise.reject(new AirfoilAnalysisCancelledError());
  }
  if (typeof Worker !== "function") {
    return Promise.reject(new Error("このブラウザでは XFOIL 解析を実行できません。設計の編集は継続できるため、対応ブラウザで再試行してください。"));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./webXfoilAnalysis.worker.ts", import.meta.url), { type: "module" });
    const abort = () => {
      cleanup();
      worker.terminate();
      reject(new AirfoilAnalysisCancelledError());
    };
    const cleanup = () => signal.removeEventListener("abort", abort);

    signal.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      worker.terminate();
      if (event.data.type === "success") {
        resolve(event.data.polar);
      } else {
        reject(new Error(event.data.message));
      }
    }, { once: true });
    worker.addEventListener("error", (event) => {
      cleanup();
      worker.terminate();
      reject(toRecoverableWorkerError(event.error instanceof Error ? event.error : new Error(event.message)));
    }, { once: true });
    worker.postMessage({
      type: "run",
      airfoil,
      settings,
      polarId: `xfoil-${airfoil.id}-${Date.now()}`,
    });
  });
}

function toRecoverableWorkerError(error: Error) {
  if (/memory|allocation|out of memory/i.test(error.message)) {
    return new Error("XFOIL 解析のメモリが不足しました。対象翼型または解析範囲を減らして再試行してください。設計の編集は継続できます。");
  }
  return new Error(`XFOIL Worker の初期化または実行に失敗しました: ${error.message}。設計の編集は継続できます。`);
}
