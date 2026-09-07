import { executeStaticAeroelasticAnalysis } from "./staticAeroelasticSolver";
import type { AeroelasticAnalysisInput } from "./webAeroelasticAnalysisRunner";

type RunRequest = { type: "run"; input: AeroelasticAnalysisInput };

self.addEventListener("message", (event: MessageEvent<RunRequest>) => {
  if (event.data.type !== "run") return;
  try {
    const result = executeStaticAeroelasticAnalysis({
      ...event.data.input,
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
    });
    self.postMessage({ type: "success", result });
  } catch (error) {
    self.postMessage({ type: "failure", message: error instanceof Error ? error.message : "空力構造連成解析に失敗しました。" });
  } finally {
    self.close();
  }
});
