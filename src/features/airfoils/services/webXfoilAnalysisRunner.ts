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
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    }, { once: true });
    worker.postMessage({
      type: "run",
      airfoil,
      settings,
      polarId: `xfoil-${airfoil.id}-${Date.now()}`,
    });
  });
}
