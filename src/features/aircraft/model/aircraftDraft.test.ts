import { describe, expect, it } from "vitest";
import { applyAircraftDraft, createAircraftDraft, validateAircraftDraft } from "./aircraftDraft";

const aircraft = {
  id: "aircraft-1",
  span: 4,
  rootChord: 1,
  tipChord: 0.5,
  taperRatio: 0.5,
  twist: 0,
  dihedral: 0,
  sweep: 0,
  incidence: 0,
  wingArea: 3,
  aspectRatio: 16 / 3,
  mac: 0.78,
  staticMargin: 8,
  sections: [
    { id: "section-root", spanPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
    { id: "section-tip", spanPosition: 2, chord: 0.5, twist: -2, dihedral: 3, airfoilId: "af-2", controlSurface: "aileron" },
  ],
};

describe("aircraft draft", () => {
  it("rejects invalid dimensions, section ordering, and airfoil references", () => {
    const draft = {
      ...createAircraftDraft(aircraft),
      span: 0,
      sections: [
        { ...aircraft.sections[0], spanPosition: 0.5, chord: 0, airfoilId: "missing" },
        { ...aircraft.sections[1], spanPosition: 0.25 },
      ],
    };

    expect(validateAircraftDraft(draft, new Set(["af-1", "af-2"]))).toEqual({
      valid: false,
      errors: expect.objectContaining({
        span: expect.any(String),
        sections: expect.arrayContaining([expect.stringContaining("Section 1"), expect.stringContaining("Section 2")]),
      }),
    });
  });

  it("derives wing metrics from saved sections", () => {
    const result = applyAircraftDraft(createAircraftDraft(aircraft), aircraft);

    expect(result).toMatchObject({
      rootChord: 1,
      tipChord: 0.5,
      taperRatio: 0.5,
      wingArea: 3,
      aspectRatio: 5.333,
      mac: 0.778,
    });
  });

  it("uses edited sections for the persisted geometry and derived metrics", () => {
    const draft = createAircraftDraft(aircraft);
    draft.sections = [
      { ...aircraft.sections[0], chord: 1.2 },
      { ...aircraft.sections[1], chord: 0.6 },
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
