import { describe, expect, it } from "vitest";
import type { TailSurface } from "./types";
import { deriveTailGeometry, validateTailSurface } from "./tailGeometry";

const horizontalTail: TailSurface = {
  id: "horizontal-tail",
  name: "Horizontal tail",
  orientation: "horizontal",
  rootPosition: { x: 4.5, y: 0, z: 0.2 },
  incidence: -1,
  sections: [
    {
      id: "ht-root",
      spanPosition: 0,
      chord: 0.8,
      xOffset: 0,
      twist: 0,
      dihedral: 10,
      leftAirfoilId: "symmetric-airfoil",
      rightAirfoilId: "symmetric-airfoil",
      chordwisePanels: 8,
      spanwisePanels: 6,
      chordwiseDistribution: "cosine",
      spanwiseDistribution: "cosine",
    },
    {
      id: "ht-tip",
      spanPosition: 1.5,
      chord: 0.4,
      xOffset: 0.3,
      twist: -1,
      dihedral: 0,
      leftAirfoilId: "symmetric-airfoil",
      rightAirfoilId: "symmetric-airfoil",
      chordwisePanels: 8,
      spanwisePanels: 1,
      chordwiseDistribution: "cosine",
      spanwiseDistribution: "uniform",
    },
  ],
  symmetric: true,
  isDoubleFin: false,
  isSymmetricFin: false,
};

describe("tail geometry", () => {
  it("derives the full geometry of a symmetric horizontal tail", () => {
    expect(deriveTailGeometry(horizontalTail)).toMatchObject({
      span: 3,
      projectedSpan: expect.closeTo(3 * Math.cos(10 * Math.PI / 180), 8),
      area: 1.8,
      projectedArea: expect.closeTo(1.8 * Math.cos(10 * Math.PI / 180), 8),
      aspectRatio: 5,
      meanAerodynamicChord: expect.closeTo(0.6222222222, 8),
      taperRatio: 0.5,
      aerodynamicCenter: {
        x: expect.closeTo(4.7888888889, 8),
        y: 0,
        z: 0.2,
      },
    });
  });

  it("treats a vertical tail as a single, non-mirrored surface", () => {
    const verticalTail: TailSurface = {
      ...horizontalTail,
      id: "vertical-tail",
      orientation: "vertical",
      rootPosition: { x: 4.4, y: 0, z: 0.1 },
      symmetric: false,
    };

    expect(deriveTailGeometry(verticalTail)).toMatchObject({
      span: 1.5,
      area: 0.9,
      aspectRatio: 2.5,
      aerodynamicCenter: { y: 0, z: expect.closeTo(0.7666666667, 8) },
    });
  });

  it("rejects invalid XFLR5 fin flags and independent foil references", () => {
    const errors = validateTailSurface(
      {
        ...horizontalTail,
        isDoubleFin: true,
        isSymmetricFin: true,
        sections: horizontalTail.sections.map((section, index) => index ? { ...section, leftAirfoilId: "missing" } : section),
      },
      new Set(["symmetric-airfoil"]),
    );

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("fin flags"),
      expect.stringContaining("left-side airfoil"),
    ]));
  });

  it("rejects invalid section ordering and missing airfoil references", () => {
    const errors = validateTailSurface(
      {
        ...horizontalTail,
        sections: [
          { ...horizontalTail.sections[0], spanPosition: 0.2, rightAirfoilId: "missing" },
          { ...horizontalTail.sections[1], spanPosition: 0.1 },
        ],
      },
      new Set(["symmetric-airfoil"]),
    );

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("root section"),
      expect.stringContaining("increase"),
      expect.stringContaining("right-side airfoil"),
    ]));
  });
});
