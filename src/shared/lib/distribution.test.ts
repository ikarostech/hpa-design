import { describe, expect, it } from "vitest";
import type { OneDimensionalDistribution } from "../model";
import { interpolateDistribution, mergeDistributionCoordinates, resampleDistribution, validateDistribution } from "./distribution";

interface Values {
  lift: number | null;
  drag: number | null;
}

const distribution: OneDimensionalDistribution<Values> = {
  axis: { key: "semi-span", unit: "m" },
  samples: [
    { position: 0, values: { lift: 100, drag: 10 } },
    { position: 1, values: { lift: 50, drag: null } },
    { position: 2, values: { lift: 0, drag: 2 } },
  ],
};

describe("one-dimensional distributions", () => {
  it("validates finite, strictly increasing samples", () => {
    expect(validateDistribution(distribution)).toEqual([]);
    expect(validateDistribution({ ...distribution, samples: [distribution.samples[1], distribution.samples[0]] })).toContain("座標は昇順かつ重複なしである必要があります。");
  });

  it("interpolates numeric values without inventing missing values or extrapolating", () => {
    expect(interpolateDistribution(distribution, 0.5)).toEqual({ lift: 75, drag: null });
    expect(interpolateDistribution(distribution, -0.1)).toBeNull();
  });

  it("resamples and merges coordinates deterministically", () => {
    expect(resampleDistribution(distribution, [0, 0.5, 2]).samples).toEqual([
      { position: 0, values: { lift: 100, drag: 10 } },
      { position: 0.5, values: { lift: 75, drag: null } },
      { position: 2, values: { lift: 0, drag: 2 } },
    ]);
    expect(mergeDistributionCoordinates([distribution, { ...distribution, samples: [{ position: 0.5, values: { lift: 1, drag: 1 } }] }])).toEqual([0, 0.5, 1, 2]);
  });
});
