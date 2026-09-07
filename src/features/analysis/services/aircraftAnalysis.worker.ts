import { executeAnalysisCase } from "./analysisExecutionService";
import type { AircraftAnalysisInput } from "./webAircraftAnalysisRunner";

type RunRequest = { type: "run"; input: AircraftAnalysisInput };

self.addEventListener("message", async (event: MessageEvent<RunRequest>) => {
  if (event.data.type !== "run") return;
  try {
    const { resultId, ...input } = event.data.input;
    const result = await executeAnalysisCase({
      ...input,
      createId: () => resultId,
      onProgress: (progress) => self.postMessage({ type: "progress", progress }),
    });
    self.postMessage({ type: "success", result });
  } catch (error) {
    self.postMessage({ type: "failure", message: error instanceof Error ? error.message : "空力解析に失敗しました。" });
  } finally {
    self.close();
  }
});
