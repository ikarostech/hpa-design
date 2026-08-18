import { describe, expect, it } from "vitest";
import type { StructuralAnalysisResult } from "../model/types";
import { toStructuralSpanDistribution } from "./structuralResultDistribution";

describe("toStructuralSpanDistribution", () => {
  it("adapts persisted structural points and preserves unavailable legacy capacities as null", () => {
    const result = {
      points: [{
        yPosition: 0.5,
        distributedLoad: 100,
        shearForce: 80,
        bendingMoment: 40,
        torque: 6,
        deflection: 0.01,
        rotation: 0.02,
        twist: 0.03,
        axialStress: 12,
        shearStress: 3,
        minReserveFactor: 2.4,
      }],
    } as StructuralAnalysisResult;

    expect(toStructuralSpanDistribution(result)).toEqual({
      axis: { key: "semi-span", unit: "m", label: "半翼幅" },
      samples: [{ position: 0.5, values: expect.objectContaining({
        distributedLift: 100,
        bendingMoment: 40,
        bendingMomentCapacity: null,
        torque: 6,
        torqueCapacity: null,
        combinedReserveFactor: 2.4,
      }) }],
    });
  });
});
