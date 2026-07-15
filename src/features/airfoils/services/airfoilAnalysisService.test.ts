import { describe, expect, it, vi } from "vitest";
import {
  AirfoilAnalysisCancelledError,
  executeAirfoilAnalysis,
  type AirfoilAnalysisRunner,
} from "./airfoilAnalysisService";
import type { AirfoilPolar } from "../model/types";

const settings = {
  reynolds: 300000,
  mach: 0.04,
  alphaStart: -6,
  alphaEnd: 18,
  alphaStep: 2,
  ncrit: 9,
  iterations: 100,
};

const airfoils = [
  { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1.5, trailingEdgeThickness: 0, coordinates: [] },
  { id: "af-2", name: "NACA2412", thicknessRatio: 12, maxCamber: 2, leadingEdgeRadius: 1.5, trailingEdgeThickness: 0, coordinates: [] },
];

function polar(airfoilId: string): AirfoilPolar {
  return {
    id: `polar-${airfoilId}`,
    airfoilId,
    caseName: `${airfoilId}-case`,
    reynolds: settings.reynolds,
    mach: settings.mach,
    alphaStart: -6,
    alphaEnd: 18,
    alphaStep: 2,
    ncrit: settings.ncrit,
    convergedPoints: 2,
    requestedPoints: 2,
    status: "complete",
    points: [],
  };
}

describe("executeAirfoilAnalysis", () => {
  it("creates one persisted run after every target completes", async () => {
    const runner: AirfoilAnalysisRunner = { run: vi.fn(async (airfoil) => polar(airfoil.id)) };
    const onProgress = vi.fn();

    const result = await executeAirfoilAnalysis({
      targets: airfoils,
      settings,
      runner,
      createId: (prefix) => `${prefix}-1`,
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      onProgress,
    });

    expect(result.polars.map((item) => item.airfoilId)).toEqual(["af-1", "af-2"]);
    expect(result.run).toMatchObject({
      id: "run-1",
      airfoilIds: ["af-1", "af-2"],
      polarIds: ["polar-af-1", "polar-af-2"],
      createdAt: "2026-07-15T12:00:00.000Z",
      status: "complete",
    });
    expect(onProgress).toHaveBeenNthCalledWith(1, { completed: 1, total: 2 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { completed: 2, total: 2 });
  });

  it("stops between targets when cancelled and never reports a completed run", async () => {
    const controller = new AbortController();
    const runner: AirfoilAnalysisRunner = {
      run: vi.fn(async (airfoil) => {
        if (airfoil.id === "af-1") {
          controller.abort();
        }
        return polar(airfoil.id);
      }),
    };

    await expect(executeAirfoilAnalysis({
      targets: airfoils,
      settings,
      runner,
      signal: controller.signal,
      createId: (prefix) => `${prefix}-1`,
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      onProgress: () => undefined,
    })).rejects.toBeInstanceOf(AirfoilAnalysisCancelledError);
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it("keeps successful polars and records a failure breakdown when one target fails", async () => {
    const runner: AirfoilAnalysisRunner = {
      run: vi.fn(async (airfoil) => {
        if (airfoil.id === "af-2") throw new Error("convergence failed");
        return polar(airfoil.id);
      }),
    };

    const result = await executeAirfoilAnalysis({
      targets: airfoils,
      settings,
      runner,
      createId: (prefix) => `${prefix}-1`,
      now: () => new Date("2026-07-15T12:00:00.000Z"),
      onProgress: () => undefined,
    });

    expect(result.polars.map((item) => item.id)).toEqual(["polar-af-1"]);
    expect(result.run).toMatchObject({
      status: "needs-review",
      failures: [{ airfoilId: "af-2", message: "convergence failed" }],
    });
  });
});
