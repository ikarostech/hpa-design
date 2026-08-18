import { describe, expect, it } from "vitest";
import { solveLiftTrim } from "./liftTrimSolver";

describe("solveLiftTrim", () => {
  it("finds the angle that matches the requested lift within tolerance", () => {
    const result = solveLiftTrim({
      targetLift: 500,
      minimumAlpha: -5,
      maximumAlpha: 15,
      relativeTolerance: 1e-8,
      evaluateLift: (alpha) => 100 + 50 * alpha,
    });

    expect(result.alphaDegrees).toBeCloseTo(8, 7);
    expect(result.lift).toBeCloseTo(500, 4);
    expect(result.relativeError).toBeLessThan(1e-8);
  });

  it("rejects a target lift that is not bracketed", () => {
    expect(() => solveLiftTrim({
      targetLift: 1_000,
      minimumAlpha: -5,
      maximumAlpha: 5,
      evaluateLift: (alpha) => 100 + 10 * alpha,
    })).toThrow("迎角範囲");
  });
});
