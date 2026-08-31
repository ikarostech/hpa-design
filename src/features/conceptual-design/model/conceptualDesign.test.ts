import { describe, expect, it } from "vitest";
import { calculateConceptualDesignMetrics, createDefaultConceptualDesign, validateConceptualDesign } from "./conceptualDesign";

describe("conceptual design", () => {
  it("provides the agreed initial human-powered-aircraft requirements", () => {
    expect(createDefaultConceptualDesign()).toEqual({
      grossMass: 100,
      cruiseSpeed: 8,
      maximumWingspan: 30,
      groundHeight: 1,
      sustainablePower: 250,
    });
  });

  it("derives flight and sizing metrics using the fixed 30 degree sea-level condition", () => {
    const metrics = calculateConceptualDesignMetrics(createDefaultConceptualDesign(), {
      span: 25,
      wingArea: 30,
    });

    expect(metrics.airDensity).toBeCloseTo(1.164, 3);
    expect(metrics.weight).toBeCloseTo(980.665, 3);
    expect(metrics.dynamicPressure).toBeCloseTo(37.25, 1);
    expect(metrics.heightToSpanRatio).toBeCloseTo(1 / 25, 6);
    expect(metrics.wingLoading).toBeCloseTo(980.665 / 30, 6);
    expect(metrics.requiredLiftCoefficient).toBeCloseTo(980.665 / (metrics.dynamicPressure * 30), 6);
    expect(metrics.wingspanMargin).toBe(5);
    expect(metrics.powerLoading).toBeCloseTo(980.665 / 250, 6);
  });

  it("requires every editable requirement to be positive", () => {
    const validation = validateConceptualDesign({
      ...createDefaultConceptualDesign(),
      cruiseSpeed: 0,
      groundHeight: -1,
    });

    expect(validation.valid).toBe(false);
    if (validation.valid) throw new Error("Expected invalid conceptual design");
    expect(validation.errors).toMatchObject({
      cruiseSpeed: expect.any(String),
      groundHeight: expect.any(String),
    });
  });
});
