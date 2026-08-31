import { describe, expect, it } from "vitest";
import type { CarbonMaterial, StructuralDesign } from "../features/structures/model/types";
import { executeStructuralAnalysis } from "../features/structures/services/structuralAnalysis";
import { aircraftGeometry, airfoilPolars, airfoils, analysisCases, analysisResult } from "../mocks/mockData";
import { designDocumentExporter, designDocumentImporter, formatValidationIssues } from "./designDocumentTransfer";

const document = {
  schemaVersion: 4 as const,
  name: "Imported Glider",
  airfoils: [],
  polars: [],
  airfoilAnalysisRuns: [],
  aircraft: { id: "geo-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.333, mac: 0.78, staticMargin: 8, sections: [] },
  analysisCases: [],
  analysisResults: [],
  carbonMaterials: [],
  structuralDesigns: [],
  structuralResults: [],
};

describe("design document transfer", () => {
  it("round-trips an exported design file", async () => {
    const text = await designDocumentExporter.export(document);
    const imported = await designDocumentImporter.parse(text);

    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
    expect(imported).toMatchObject({ name: "Imported Glider", aircraft: { id: "geo-1" } });
  });

  it("round-trips saved structural results including infinite reserve factors", async () => {
    const material: CarbonMaterial = {
      id: "carbon-1", name: "Carbon", e1: 120e9, e2: 8e9, g12: 4e9, nu12: 0.3,
      tensileStrength1: 1200e6, compressiveStrength1: 700e6, tensileStrength2: 40e6,
      compressiveStrength2: 120e6, shearStrength12: 60e6, density: 1550,
      plyThickness: 0.000125, reductionFactor: 0.8,
    };
    const loadCase = {
      id: "load-1", name: "No load", source: "manual" as const, loadFactor: 1, safetyFactor: 1,
      distributedLoads: [], pointLoads: [], status: "completed" as const,
    };
    const design: StructuralDesign = {
      id: "spar-1", name: "Main spar",
      sections: [{ id: "root", length: 1, outerDiameter: 0.1, plies: [{ id: "axial", materialId: material.id, angle: 0, count: 4 }] }],
      loadCases: [loadCase],
    };
    const result = executeStructuralAnalysis({ design, loadCase, materials: [material], resultId: "result-1", sampleCount: 3 });
    const text = await designDocumentExporter.export({ ...document, carbonMaterials: [material], structuralDesigns: [design], structuralResults: [result] });
    const imported = await designDocumentImporter.parse(text);

    expect(imported.structuralResults[0].summary.minReserveFactor).toBe(Number.POSITIVE_INFINITY);
    expect(imported.structuralResults[0].points[0].bendingReserveFactor).toBe(Number.POSITIVE_INFINITY);
    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
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
      schemaVersion: 4,
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
      schemaVersion: 4,
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
      carbonMaterials: [],
      structuralDesigns: [],
      structuralResults: [],
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
  });

  it("validates aerodynamic span distribution coordinates and values", async () => {
    const analysisCase = { id: "case-1", name: "Cruise", method: "VLM", alphaStart: 4, alphaEnd: 4, alphaStep: 1, speed: 20, altitude: 0, reynolds: 300000, geometryId: document.aircraft.id, status: "completed" };
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      analysisCases: [analysisCase],
      analysisResults: [{
        id: "result-1", caseId: analysisCase.id, clMax: 0.5, cdMin: 0.03, maxLD: 16, cm0: -0.04, status: "completed",
        rows: [{
          caseId: analysisCase.id, alpha: 4, cl: 0.5, cd: 0.03, cm: -0.04, ld: 16, status: "completed",
          spanwise: { axis: { key: "semi-span", unit: "m" }, reference: { side: "right", origin: "centerline", alphaDegrees: 4, speed: 20, density: 1.225, elasticAxisChordFraction: 0.35 }, samples: [{ position: "bad", values: { liftPerLength: 100 } }] },
        }],
      }],
    }));

    const validation = await designDocumentImporter.validate(imported);

    expect(validation).toMatchObject({ valid: false });
    if (!validation.valid) expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["analysisResults", "0", "rows", "0", "spanwise", "samples", "0", "position"] }),
      expect.objectContaining({ path: ["analysisResults", "0", "rows", "0", "spanwise", "samples", "0", "values", "dragPerLength"] }),
    ]));
  });

  it("migrates version 3 interpolation stations to constant-length tube sections", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      schemaVersion: 3,
      structuralDesigns: [{
        id: "spar-1", name: "Main spar", loadCases: [],
        stations: [
          { id: "root", yPosition: 0, outerDiameter: 0.08, plies: [] },
          { id: "mid", yPosition: 0.8, outerDiameter: 0.06, plies: [] },
          { id: "tip", yPosition: 1.6, outerDiameter: 0.04, plies: [] },
        ],
      }],
    }));

    expect(imported).toMatchObject({
      schemaVersion: 4,
      structuralDesigns: [{
        id: "spar-1",
        sections: [
          expect.objectContaining({ id: "root", length: 0.4, outerDiameter: 0.08 }),
          expect.objectContaining({ id: "mid", length: 0.8, outerDiameter: 0.06 }),
          expect.objectContaining({ id: "tip", length: 0.4, outerDiameter: 0.04 }),
        ],
      }],
    });
    expect("stations" in imported.structuralDesigns[0]).toBe(false);
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

  it("validates optional conceptual design requirements when present", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      conceptualDesign: { grossMass: 100, cruiseSpeed: 0, maximumWingspan: 30, groundHeight: 1, sustainablePower: 250 },
    }));

    const validation = await designDocumentImporter.validate(imported);

    expect(validation).toMatchObject({ valid: false });
    if (!validation.valid) expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["conceptualDesign", "cruiseSpeed"] }),
    ]));
  });

  it("rejects invalid partial-ply angle and upper/lower width", async () => {
    const material = { id: "carbon", name: "Carbon", e1: 120e9, e2: 8e9, g12: 4e9, nu12: 0.3, tensileStrength1: 1200e6, compressiveStrength1: 700e6, tensileStrength2: 40e6, compressiveStrength2: 120e6, shearStrength12: 60e6, density: 1550, plyThickness: 0.000125, reductionFactor: 0.8 };
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      carbonMaterials: [material],
      structuralDesigns: [{
        id: "spar", name: "Main spar", loadCases: [],
        sections: [{ id: "root", length: 1, outerDiameter: 0.1, plies: [{ id: "cap", materialId: material.id, angle: 0, count: 1, partialAngle: 120, partialWidth: -0.01 }] }],
      }],
    }));

    const validation = await designDocumentImporter.validate(imported);

    expect(validation).toMatchObject({ valid: false });
    if (!validation.valid) expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["structuralDesigns", "0", "sections", "0", "plies", "0", "partialAngle"] }),
      expect.objectContaining({ path: ["structuralDesigns", "0", "sections", "0", "plies", "0", "partialWidth"] }),
    ]));
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

  it("validates saved aeroelastic result references", async () => {
    const imported = await designDocumentImporter.parse(JSON.stringify({
      ...document,
      aeroelasticResults: [{
        id: "coupled-1",
        createdAt: "2026-08-15T00:00:00.000Z",
        status: "converged",
        reviewStatus: "current",
        structuralDesignId: "missing-structure",
        materialIds: [],
      }],
    }));

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["aeroelasticResults", "0", "structuralDesignId"], severity: "error" }),
      ]),
    });
  });
});
