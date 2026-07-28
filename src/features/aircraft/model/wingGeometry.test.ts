import { describe, expect, it } from "vitest";
import { deriveWingGeometry, validateWingSections } from "./wingGeometry";

const sections = [
  {
    id: "root",
    yPosition: 0,
    chord: 1,
    xOffset: 0,
    twist: 0,
    dihedral: 5,
    airfoilId: "af-root",
    chordwisePanels: 12,
    spanwisePanels: 8,
    chordwiseDistribution: "cosine" as const,
    spanwiseDistribution: "uniform" as const,
  },
  {
    id: "mid",
    yPosition: 1,
    chord: 0.8,
    xOffset: 0.1,
    twist: -1,
    dihedral: 10,
    airfoilId: "af-mid",
    chordwisePanels: 12,
    spanwisePanels: 8,
    chordwiseDistribution: "cosine" as const,
    spanwiseDistribution: "cosine" as const,
  },
  {
    id: "tip",
    yPosition: 2,
    chord: 0.5,
    xOffset: 0.4,
    twist: -3,
    dihedral: 0,
    airfoilId: "af-tip",
    chordwisePanels: 12,
    spanwisePanels: 1,
    chordwiseDistribution: "cosine" as const,
    spanwiseDistribution: "uniform" as const,
  },
];

describe("wing geometry", () => {
  it("derives XFLR5-style planform metrics and section heights from sections", () => {
    const result = deriveWingGeometry(sections);

    expect(result.span).toBeCloseTo(4, 8);
    expect(result.rootChord).toBeCloseTo(1, 8);
    expect(result.tipChord).toBeCloseTo(0.5, 8);
    expect(result.wingArea).toBeCloseTo(3.1, 8);
    expect(result.aspectRatio).toBeCloseTo(16 / 3.1, 8);
    expect(result.mac).toBeCloseTo(1.2433333333 / 1.55, 8);
    expect(result.sweep).toBeCloseTo(Math.atan2(0.275, 2) * 180 / Math.PI, 8);
    expect(result.twist).toBeCloseTo(-3, 8);
    expect(result.sectionPositions.map(({ zPosition }) => zPosition)).toEqual([
      0,
      expect.closeTo(Math.tan(5 * Math.PI / 180), 8),
      expect.closeTo(Math.tan(5 * Math.PI / 180) + Math.tan(10 * Math.PI / 180), 8),
    ]);
  });

  it("rejects a non-root first section and duplicate span positions", () => {
    const errors = validateWingSections(
      [
        { ...sections[0], yPosition: 0.2 },
        { ...sections[1], yPosition: 0.2 },
      ],
      new Set(["af-root", "af-mid"]),
    );

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("root section"),
      expect.stringContaining("increase"),
    ]));
  });

  it("rejects invalid chordwise and spanwise panel counts", () => {
    const errors = validateWingSections(
      [
        { ...sections[0], chordwisePanels: 0 },
        { ...sections[1], spanwisePanels: 2.5 },
      ],
      new Set(["af-root", "af-mid"]),
    );

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining("chordwise panels"),
      expect.stringContaining("spanwise panels"),
    ]));
  });
});
