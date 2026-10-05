import { describe, expect, it } from "vitest";
import { alignSectionsToStraightSpar } from "./sparGeometry";

describe("alignSectionsToStraightSpar", () => {
  it("preserves the root leading edge and aligns every section at the selected chord fraction", () => {
    const sections = [
      { id: "root", chord: 0.8, xOffset: 0.1 },
      { id: "middle", chord: 0.6, xOffset: 0 },
      { id: "tip", chord: 0.4, xOffset: 0.3 },
    ];

    const aligned = alignSectionsToStraightSpar(sections, 0.3);

    expect(aligned.map((section) => section.xOffset)).toEqual([0.1, 0.16, 0.22]);
    for (const section of aligned) expect(section.xOffset + 0.3 * section.chord).toBeCloseTo(0.34, 8);
    expect(sections.map((section) => section.xOffset)).toEqual([0.1, 0, 0.3]);
  });

  it("rejects a spar position outside the chord", () => {
    expect(() => alignSectionsToStraightSpar([{ chord: 1, xOffset: 0 }], 1.2)).toThrow();
  });
});
