import { executeStructuralAnalysis } from "./structuralAnalysis";

type RunRequest = {
  type: "run";
  input: Parameters<typeof executeStructuralAnalysis>[0];
};

self.addEventListener("message", (event: MessageEvent<RunRequest>) => {
  if (event.data.type !== "run") return;
  try {
    self.postMessage({ type: "success", result: executeStructuralAnalysis(event.data.input) });
  } catch (error) {
    self.postMessage({ type: "failure", message: error instanceof Error ? error.message : "構造解析に失敗しました。" });
  } finally {
    self.close();
  }
});
