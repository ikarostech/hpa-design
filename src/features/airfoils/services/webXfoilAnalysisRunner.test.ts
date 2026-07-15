import { describe, expect, it } from "vitest";
import { webXfoilAnalysisRunner } from "./webXfoilAnalysisRunner";

const airfoil = { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] };
const settings = { reynolds: 300000, mach: 0.04, alphaStart: -4, alphaEnd: 8, alphaStep: 2, ncrit: 9, iterations: 100 };

describe("webXfoilAnalysisRunner", () => {
  it("reports a recoverable message when Web Workers are unavailable", async () => {
    const originalWorker = globalThis.Worker;
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });

    try {
      await expect(webXfoilAnalysisRunner.run(airfoil, settings, new AbortController().signal)).rejects.toThrow("このブラウザでは XFOIL 解析を実行できません");
    } finally {
      Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker });
    }
  });
});
