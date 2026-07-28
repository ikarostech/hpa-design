import { describe, expect, it } from "vitest";
import { applyAircraftDraft, createAircraftDraft, validateAircraftDraft } from "./aircraftDraft";
import type { AircraftGeometry, WingSection } from "./types";

const sectionDefaults = {
  xOffset: 0,
  chordwisePanels: 12,
  spanwisePanels: 8,
  chordwiseDistribution: "cosine" as const,
  spanwiseDistribution: "uniform" as const,
};

const sections: WingSection[] = [
  { ...sectionDefaults, id: "section-root", yPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1" },
  { ...sectionDefaults, id: "section-tip", yPosition: 2, chord: 0.5, xOffset: 0.25, twist: -2, dihedral: 0, airfoilId: "af-2" },
];

const aircraft: AircraftGeometry = {
  id: "aircraft-1",
  span: 99,
  rootChord: 99,
  tipChord: 99,
  taperRatio: 1,
  twist: 99,
  dihedral: 99,
  sweep: 99,
  incidence: 0,
  wingArea: 99,
  aspectRatio: 99,
  mac: 99,
  staticMargin: 8,
  sections,
};

describe("aircraft draft", () => {
  it("rejects invalid section geometry and airfoil references", () => {
    const draft = createAircraftDraft(aircraft);
    draft.sections = [
      { ...sections[0], yPosition: 0.5, chord: 0, airfoilId: "missing" },
      { ...sections[1], yPosition: 0.25 },
    ];

    expect(validateAircraftDraft(draft, new Set(["af-1", "af-2"]))).toEqual({
      valid: false,
      errors: expect.objectContaining({
        sections: expect.arrayContaining([expect.stringContaining("Section 1"), expect.stringContaining("Section 2")]),
      }),
    });
  });

  it("keeps only placement values and sections editable", () => {
    expect(createAircraftDraft(aircraft)).toEqual({
      incidence: 0,
      staticMargin: 8,
      sections,
    });
  });

  it("derives persisted summaries from sections instead of stale aircraft values", () => {
    const result = applyAircraftDraft(createAircraftDraft(aircraft), aircraft);

    expect(result).toMatchObject({
      span: 4,
      rootChord: 1,
      tipChord: 0.5,
      taperRatio: 0.5,
      twist: -2,
      dihedral: 0,
      sweep: 3.576,
      wingArea: 3,
      aspectRatio: 5.333,
      mac: 0.778,
    });
  });

  it("uses edited sections for the persisted geometry and derived metrics", () => {
    const draft = createAircraftDraft(aircraft);
    draft.sections = [
      { ...sections[0], chord: 1.2 },
      { ...sections[1], chord: 0.6, xOffset: 0.3 },
    ];

    expect(applyAircraftDraft(draft, aircraft)).toMatchObject({
      rootChord: 1.2,
      tipChord: 0.6,
      wingArea: 3.6,
      aspectRatio: 4.444,
      mac: 0.933,
    });
  });
});
