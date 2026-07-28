import { describe, expect, it } from "vitest";
import { aircraftGeometry, airfoilPolars, airfoils, analysisCases, analysisResult } from "../mocks/mockData";
import { designDocumentExporter, designDocumentImporter, formatValidationIssues } from "./designDocumentTransfer";

const document = {
  schemaVersion: 2 as const,
  name: "Imported Glider",
  airfoils: [],
  polars: [],
  airfoilAnalysisRuns: [],
  aircraft: { id: "geo-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.333, mac: 0.78, staticMargin: 8, sections: [] },
  analysisCases: [],
  analysisResults: [],
};

describe("design document transfer", () => {
  it("round-trips an exported design file", async () => {
    const text = await designDocumentExporter.export(document);
    const imported = await designDocumentImporter.parse(text);

    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
    expect(imported).toMatchObject({ name: "Imported Glider", aircraft: { id: "geo-1" } });
  });

  it("migrates version 1 wing sections to the XFLR5-style schema", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      schemaVersion: 1,
      airfoils: [{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [{ x: 0, upper: 0, lower: 0 }, { x: 0.5, upper: 0.1, lower: -0.1 }, { x: 1, upper: 0, lower: 0 }] }],
      aircraft: {
        ...document.aircraft,
        sweep: 10,
        sections: [
          { id: "root", spanPosition: 0, chord: 1, twist: 0, dihedral: 5, airfoilId: "af-1", controlSurface: "none" },
          { id: "tip", spanPosition: 2, chord: 0.5, twist: -2, dihedral: 0, airfoilId: "af-1", controlSurface: "aileron" },
        ],
      },
    }));

    expect(imported).toMatchObject({
      schemaVersion: 2,
      aircraft: {
        sections: [
          expect.objectContaining({ yPosition: 0, xOffset: 0, chordwisePanels: 12, spanwisePanels: 8 }),
          expect.objectContaining({ yPosition: 2, xOffset: expect.closeTo(2 * Math.tan(10 * Math.PI / 180), 5) }),
        ],
      },
    });
    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
  });

  it("accepts the populated document used to initialize the application", async () => {
    const imported = await designDocumentImporter.parse(await designDocumentExporter.export({
      schemaVersion: 2,
      name: "LongRange UAV",
      airfoils,
      polars: airfoilPolars,
      airfoilAnalysisRuns: [{
        id: "run-initial-polars",
        name: "Initial Polar analysis",
        airfoilIds: Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))),
        polarIds: airfoilPolars.map((polar) => polar.id),
        createdAt: "2026-06-21T00:00:00.000Z",
        reynolds: 300000,
        mach: 0.04,
        alphaStart: -6,
        alphaEnd: 18,
        alphaStep: 2,
        status: "complete",
      }],
      aircraft: aircraftGeometry,
      analysisCases,
      analysisResults: [analysisResult],
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
  });

  it("rejects a file without the design document schema", async () => {
    const imported = await designDocumentImporter.parse('{"name":"Missing schema"}');

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["schemaVersion"], message: "対応していない設計ファイルのバージョンです。", severity: "error" }),
      ]),
    });
  });

  it("rejects malformed document structures with field paths", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      polars: undefined,
      aircraft: { ...document.aircraft, span: "four" },
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["polars"], severity: "error" }),
        expect.objectContaining({ path: ["aircraft", "span"], severity: "error" }),
      ]),
    });
  });

  it("distinguishes invalid JSON from schema validation errors", async () => {
    await expect(designDocumentImporter.parse('{"name":')).rejects.toThrow("JSON");
  });

  it("formats validation errors with their document paths", () => {
    expect(formatValidationIssues([
      { path: ["aircraft", "span"], message: "有限の数値である必要があります。", severity: "error" },
      { message: "配列である必要があります。", severity: "error" },
    ])).toBe("aircraft.span: 有限の数値である必要があります。\n配列である必要があります。");
  });

  it("rejects duplicate IDs and unknown airfoil references", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      airfoils: [
        { id: "af-1", name: "First", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [{ x: 0, upper: 0, lower: 0 }, { x: 0.5, upper: 0.1, lower: -0.1 }, { x: 1, upper: 0, lower: 0 }] },
        { id: "af-1", name: "Duplicate", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [{ x: 0, upper: 0, lower: 0 }, { x: 0.5, upper: 0.1, lower: -0.1 }, { x: 1, upper: 0, lower: 0 }] },
      ],
      polars: [{ id: "pol-1", airfoilId: "missing-airfoil", caseName: "Test", reynolds: 300000, mach: 0.04, alphaStart: -4, alphaEnd: 12, alphaStep: 2, ncrit: 9, convergedPoints: 9, requestedPoints: 9, status: "complete", points: [] }],
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["airfoils", "1", "id"], severity: "error" }),
        expect.objectContaining({ path: ["polars", "0", "airfoilId"], severity: "error" }),
      ]),
    });
  });

  it("rejects a wing section that references a missing airfoil", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      aircraft: {
        ...document.aircraft,
        sections: [{ id: "section-1", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "missing-airfoil", chordwisePanels: 12, spanwisePanels: 8, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform" }],
      },
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["aircraft", "sections", "0", "airfoilId"], severity: "error" }),
      ]),
    });
  });

  it("rejects non-integer or out-of-range wing panel counts", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      aircraft: {
        ...document.aircraft,
        sections: [{ id: "section-1", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "missing-airfoil", chordwisePanels: 0, spanwisePanels: 2.5, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform" }],
      },
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["aircraft", "sections", "0", "chordwisePanels"], severity: "error" }),
        expect.objectContaining({ path: ["aircraft", "sections", "0", "spanwisePanels"], severity: "error" }),
      ]),
    });
  });

  it("rejects references to missing aircraft geometry and analysis cases", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      analysisCases: [{ id: "case-1", name: "Cruise", method: "LLT", alphaStart: -2, alphaEnd: 8, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId: "missing-geometry", status: "not-run" }],
      analysisResults: [{ id: "result-1", caseId: "missing-case", clMax: 1, cdMin: 0.01, maxLD: 20, cm0: 0, status: "completed", rows: [] }],
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["analysisCases", "0", "geometryId"], severity: "error" }),
        expect.objectContaining({ path: ["analysisResults", "0", "caseId"], severity: "error" }),
      ]),
    });
  });
});
