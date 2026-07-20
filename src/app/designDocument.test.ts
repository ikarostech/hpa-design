import { describe, expect, it } from "vitest";
import { createDesignDocumentStore } from "./designDocument";

const document = {
  schemaVersion: 1 as const,
  name: "LongRange UAV",
  airfoils: [
    { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1.5, trailingEdgeThickness: 0, coordinates: [] },
  ],
  polars: [],
  airfoilAnalysisRuns: [],
  aircraft: {
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
    sections: [],
  },
  analysisCases: [],
  analysisResults: [],
};

describe("createDesignDocumentStore", () => {
  it("marks an edit as unsaved until the document is marked saved", () => {
    const store = createDesignDocumentStore(document);

    store.updateAircraft({ span: 6 });

    expect(store.getState()).toMatchObject({ revision: 1, savedRevision: 0, isDirty: true });

    store.markSaved();

    expect(store.getState()).toMatchObject({ revision: 1, savedRevision: 1, isDirty: false });
  });

  it("keeps edits in the one active design document", () => {
    const store = createDesignDocumentStore(document);

    store.saveAirfoil({ ...document.airfoils[0], id: "af-2", name: "Custom" });

    expect(store.getDocument().airfoils.map((airfoil) => airfoil.id)).toEqual(["af-2", "af-1"]);
    expect(store.getDocument().name).toBe("LongRange UAV");
  });

  it("replaces the active document when an imported file is loaded", () => {
    const store = createDesignDocumentStore(document);
    const imported = { ...document, name: "Imported Glider", airfoils: [] };

    store.replaceDocument(imported);

    expect(store.getDocument()).toMatchObject({ name: "Imported Glider", airfoils: [] });
    expect(store.getState()).toMatchObject({ isDirty: false });
  });

  it("keeps a recovered working document marked as unsaved", () => {
    const store = createDesignDocumentStore(document, { saved: false });

    expect(store.getState()).toMatchObject({ revision: 0, savedRevision: -1, isDirty: true });
  });

  it("derives wing metrics from editable geometry", () => {
    const store = createDesignDocumentStore(document);

    store.updateAircraft({ span: 6, rootChord: 1.2, tipChord: 0.6 });

    expect(store.getDocument().aircraft).toMatchObject({
      span: 6,
      taperRatio: 0.5,
      wingArea: 5.4,
      aspectRatio: 6.667,
      mac: 0.933,
    });
  });

  it("derives persisted wing metrics from edited sections", () => {
    const store = createDesignDocumentStore({
      ...document,
      aircraft: {
        ...document.aircraft,
        span: 4,
        rootChord: 1,
        tipChord: 0.5,
        sections: [
          { id: "section-root", spanPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
          { id: "section-tip", spanPosition: 2, chord: 0.5, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
        ],
      },
    });

    store.updateAircraft({
      sections: [
        { id: "section-root", spanPosition: 0, chord: 1.2, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
        { id: "section-tip", spanPosition: 2, chord: 0.6, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
      ],
    });

    expect(store.getDocument().aircraft).toMatchObject({
      rootChord: 1.2,
      tipChord: 0.6,
      wingArea: 3.6,
      aspectRatio: 4.444,
      mac: 0.933,
    });
  });

  it("persists analysis cases and removes their related results with the case", () => {
    const analysisCase = {
      id: "case-1", name: "Cruise", method: "LLT" as const,
      alphaStart: -2, alphaEnd: 10, alphaStep: 2, speed: 20, altitude: 100, reynolds: 400000,
      geometryId: "aircraft-1", status: "not-run" as const,
    };
    const store = createDesignDocumentStore({
      ...document,
      analysisCases: [analysisCase],
      analysisResults: [{
        id: "result-1", caseId: analysisCase.id, clMax: 1.1, cdMin: 0.02, maxLD: 18, cm0: -0.04,
        status: "completed" as const, rows: [],
      }],
    });

    store.saveAnalysisCase({ ...analysisCase, name: "Updated cruise" });
    store.removeAnalysisCase(analysisCase.id);

    expect(store.getDocument()).toMatchObject({ analysisCases: [], analysisResults: [] });
    expect(store.getState().isDirty).toBe(true);
  });

  it("marks an existing result stale after case inputs change and replaces it after a rerun", () => {
    const analysisCase = {
      id: "case-1", name: "Cruise", method: "LLT" as const,
      alphaStart: -2, alphaEnd: 10, alphaStep: 2, speed: 20, altitude: 100, reynolds: 400000,
      geometryId: "aircraft-1", status: "completed" as const,
    };
    const previousResult = {
      id: "result-1", caseId: analysisCase.id, clMax: 1.1, cdMin: 0.02, maxLD: 18, cm0: -0.04,
      status: "completed" as const,
      caseSnapshot: analysisCase,
      rows: [{ caseId: analysisCase.id, alpha: 0, cl: 0, cd: 0.02, cm: -0.04, ld: 0, status: "completed" as const }],
    };
    const store = createDesignDocumentStore({ ...document, analysisCases: [analysisCase], analysisResults: [previousResult] });

    store.saveAnalysisCase({ ...analysisCase, speed: 22, status: "needs-review" });
    expect(store.getDocument().analysisResults[0]).toMatchObject({ status: "needs-review", rows: [{ status: "needs-review" }] });

    store.saveAnalysisResult({ ...previousResult, id: "result-2", clMax: 1.2, status: "completed" });
    expect(store.getDocument()).toMatchObject({
      analysisCases: [{ id: analysisCase.id, status: "completed" }],
      analysisResults: [{ id: "result-2", status: "completed" }],
    });
  });

  it("rejects deletion of a referenced airfoil and marks dependent data stale after its coordinates change", () => {
    const referencedAirfoil = { ...document.airfoils[0], coordinates: [{ x: 0, upper: 0, lower: 0 }] };
    const store = createDesignDocumentStore({
      ...document,
      airfoils: [referencedAirfoil],
      aircraft: { ...document.aircraft, sections: [{ id: "root", spanPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" }] },
      polars: [{ id: "polar-1", airfoilId: "af-1", caseName: "Cruise", reynolds: 300000, mach: 0.04, alphaStart: -2, alphaEnd: 8, alphaStep: 2, ncrit: 9, convergedPoints: 2, requestedPoints: 2, status: "complete", points: [] }],
      airfoilAnalysisRuns: [{ id: "run-1", name: "Cruise", airfoilIds: ["af-1"], polarIds: ["polar-1"], createdAt: "2026-07-15T00:00:00.000Z", reynolds: 300000, mach: 0.04, alphaStart: -2, alphaEnd: 8, alphaStep: 2, status: "complete" }],
      analysisResults: [{ id: "result-1", caseId: "case-1", clMax: 1, cdMin: 0.02, maxLD: 20, cm0: 0, status: "completed", airfoilIds: ["af-1"], polarIds: ["polar-1"], rows: [{ caseId: "case-1", alpha: 0, cl: 0, cd: 0.02, cm: 0, ld: 0, status: "completed" }] }],
    });

    expect(() => store.removeAirfoil("af-1")).toThrow("used by 4 saved item(s)");

    store.saveAirfoil({ ...referencedAirfoil, coordinates: [{ x: 0, upper: 0.01, lower: 0 }] });

    expect(store.getDocument()).toMatchObject({
      polars: [{ id: "polar-1", status: "needs-review" }],
      airfoilAnalysisRuns: [{ id: "run-1", status: "needs-review" }],
      analysisResults: [{ id: "result-1", status: "needs-review", rows: [{ status: "needs-review" }] }],
    });
  });

  it("removes only orphaned polars when an airfoil analysis run is deleted", () => {
    const polar = { id: "polar-1", airfoilId: "af-1", caseName: "Cruise", reynolds: 300000, mach: 0.04, alphaStart: -2, alphaEnd: 8, alphaStep: 2, ncrit: 9, convergedPoints: 2, requestedPoints: 2, status: "complete" as const, points: [] };
    const run = { id: "run-1", name: "Cruise", airfoilIds: ["af-1"], polarIds: [polar.id], createdAt: "2026-07-15T00:00:00.000Z", reynolds: 300000, mach: 0.04, alphaStart: -2, alphaEnd: 8, alphaStep: 2, status: "complete" as const };
    const store = createDesignDocumentStore({ ...document, polars: [polar], airfoilAnalysisRuns: [run], analysisResults: [{ id: "result-1", caseId: "case-1", clMax: 1, cdMin: 0.02, maxLD: 20, cm0: 0, status: "completed" as const, polarIds: [polar.id], rows: [] }] });

    store.removeAirfoilAnalysisRun(run.id);

    expect(store.getDocument()).toMatchObject({ airfoilAnalysisRuns: [], polars: [{ id: polar.id }] });
  });
});
