import { describe, expect, it } from "vitest";
import type { Airfoil } from "./types";
import { buildXfoilAirfoilInput } from "./xfoilAirfoilInput";

describe("buildXfoilAirfoilInput", () => {
  it("resamples a dense shared surface grid before sending it to XFOIL", () => {
    const coordinates = Array.from({ length: 156 }, (_, index) => {
      const x = index / 155;
      return { x, upper: 0.08 * Math.sin(Math.PI * x), lower: -0.04 * Math.sin(Math.PI * x) };
    });
    const airfoil: Airfoil = {
      id: "dense-foil",
      name: "Dense foil",
      thicknessRatio: 12,
      maxCamber: 2,
      leadingEdgeRadius: 1,
      trailingEdgeThickness: 0,
      coordinates,
    };

    const input = buildXfoilAirfoilInput(airfoil);

    expect(input.kind).toBe("file");
    if (input.kind === "file") {
      expect(input.text.split("\n")).toHaveLength(158);
    }
  });
});
