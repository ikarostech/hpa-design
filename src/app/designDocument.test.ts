import { describe, expect, it } from "vitest";
import { createDesignDocumentStore } from "./designDocument";
import type { StaticAeroelasticResult } from "../features/aeroelastic/services/staticAeroelasticSolver";
import { createDefaultConceptualDesign } from "../features/conceptual-design/model/conceptualDesign";

const sectionDefaults = { xOffset: 0, chordwisePanels: 12, spanwisePanels: 8, chordwiseDistribution: "cosine" as const, spanwiseDistribution: "uniform" as const };
const rootSection = { ...sectionDefaults, id: "section-root", yPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1" };
const tipSection = { ...sectionDefaults, id: "section-tip", yPosition: 2, chord: 0.5, twist: 0, dihedral: 0, airfoilId: "af-1" };

const document = {
  schemaVersion: 5 as const,
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
    sections: [rootSection, tipSection],
  },
  analysisCases: [],
  analysisResults: [],
  carbonMaterials: [],
  structuralDesigns: [],
  structuralResults: [],
};

describe("createDesignDocumentStore", () => {
  it("persists conceptual design requirements and marks the document unsaved", () => {
    const store = createDesignDocumentStore(document);
    const conceptualDesign = { ...createDefaultConceptualDesign(), cruiseSpeed: 9.5 };

    store.updateConceptualDesign(conceptualDesign);

    expect(store.getDocument().conceptualDesign).toEqual(conceptualDesign);
    expect(store.getState().isDirty).toBe(true);
  });

  it("marks an edit as unsaved until the document is marked saved", () => {
    const store = createDesignDocumentStore(document);

    store.updateAircraft({ incidence: 1 });

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

  it("derives wing metrics from edited sections", () => {
    const store = createDesignDocumentStore(document);

    store.updateAircraft({ sections: [
      { ...rootSection, chord: 1.2 },
      { ...tipSection, yPosition: 3, chord: 0.6 },
    ] });

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
        sections: [rootSection, tipSection],
      },
    });

    store.updateAircraft({
      sections: [
        { ...rootSection, chord: 1.2 },
        { ...tipSection, chord: 0.6 },
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

  it("marks aircraft analysis results stale after wing geometry changes", () => {
    const analysisCase = { id: "case-1", name: "Cruise", method: "LLT" as const, alphaStart: 0, alphaEnd: 4, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId: document.aircraft.id, status: "completed" as const };
    const store = createDesignDocumentStore({
      ...document,
      analysisCases: [analysisCase],
      analysisResults: [{ id: "result-1", caseId: analysisCase.id, clMax: 1, cdMin: 0.02, maxLD: 20, cm0: 0, status: "completed", rows: [{ caseId: analysisCase.id, alpha: 0, cl: 0, cd: 0.02, cm: 0, ld: 0, status: "completed" }] }],
    });

    store.updateAircraft({ sections: [rootSection, { ...tipSection, xOffset: 0.2 }] });

    expect(store.getDocument()).toMatchObject({
      analysisCases: [{ id: analysisCase.id, status: "needs-review" }],
      analysisResults: [{ id: "result-1", status: "needs-review", rows: [{ status: "needs-review" }] }],
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

  it("deep-clones saved aerodynamic span distributions", () => {
    const analysisCase = {
      id: "case-span", name: "Span", method: "VLM" as const,
      alphaStart: 4, alphaEnd: 4, alphaStep: 1, speed: 20, altitude: 0, reynolds: 300000,
      geometryId: document.aircraft.id, status: "completed" as const,
    };
    const spanwise = {
      axis: { key: "semi-span" as const, unit: "m" as const, label: "半翼幅" },
      reference: { side: "right" as const, origin: "centerline" as const, alphaDegrees: 4, speed: 20, density: 1.225, elasticAxisChordFraction: 0.35 },
      samples: [{ position: 0.5, values: { stationWidth: 1, chord: 1, circulation: 1, localLiftCoefficient: 0.5, liftPerLength: 100, inducedDragPerLength: 2, profileDragPerLength: 1, dragPerLength: 3, pitchingMomentPerLength: -1, torqueAboutElasticAxisPerLength: 4 } }],
    };
    const result = { id: "result-span", caseId: analysisCase.id, clMax: 0.5, cdMin: 0.03, maxLD: 16, cm0: -0.04, status: "completed" as const, rows: [{ caseId: analysisCase.id, alpha: 4, cl: 0.5, cd: 0.03, cm: -0.04, ld: 16, status: "completed" as const, spanwise }] };
    const store = createDesignDocumentStore({ ...document, analysisCases: [analysisCase] });

    store.saveAnalysisResult(result);
    spanwise.samples[0].values.liftPerLength = 999;

    expect(store.getDocument().analysisResults[0].rows[0].spanwise?.samples[0].values.liftPerLength).toBe(100);
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
      aircraft: { ...document.aircraft, sections: [{ ...rootSection, id: "root" }] },
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

  it("persists structural inputs and marks related results stale after a design edit", () => {
    const material = { id: "mat-1", name: "UD carbon", e1: 120e9, e2: 8e9, g12: 4e9, nu12: 0.3, tensileStrength1: 1200e6, compressiveStrength1: 700e6, tensileStrength2: 40e6, compressiveStrength2: 120e6, shearStrength12: 60e6, density: 1550, plyThickness: 0.000125, reductionFactor: 0.8 };
    const design = { id: "struct-1", name: "Main spar", sections: [{ id: "s0", length: 1, outerDiameter: 0.08, plies: [{ id: "p0", materialId: material.id, angle: 0 as const, count: 4 }] }, { id: "s1", length: 1, outerDiameter: 0.05, plies: [{ id: "p1", materialId: material.id, angle: 0 as const, count: 2 }] }], loadCases: [{ id: "load-1", name: "Cruise", source: "elliptical" as const, loadFactor: 1, safetyFactor: 1.5, distributedLoads: [], pointLoads: [], status: "completed" as const }] };
    const store = createDesignDocumentStore(document);

    store.saveCarbonMaterial(material);
    store.saveStructuralDesign(design);
    store.saveStructuralResult({ id: "sr-1", designId: design.id, loadCaseId: "load-1", status: "completed", createdAt: "2026-07-31T00:00:00.000Z", designSnapshot: design, loadCaseSnapshot: design.loadCases[0], materialIds: [material.id], points: [], summary: { mass: 1, maxDeflection: 0.1, maxTwist: 0.01, minReserveFactor: 2, governingLoadCase: "Cruise", governingPosition: 0, governingPlyId: "p0", governingMode: "繊維引張", reactionForce: -100, reactionMoment: -50, forceBalanceError: 0 } });
    store.saveStructuralDesign({ ...design, sections: design.sections.map((section, index) => index ? section : { ...section, outerDiameter: 0.09 }) });

    expect(store.getDocument()).toMatchObject({
      carbonMaterials: [{ id: material.id }],
      structuralDesigns: [{ id: design.id }],
      structuralResults: [{ id: "sr-1", status: "needs-review" }],
    });
  });

  it("marks aerodynamic structural results stale after the aircraft geometry changes", () => {
    const store = createDesignDocumentStore({
      ...document,
      structuralResults: [{ id: "sr-aero", designId: "struct-1", loadCaseId: "load-aero", status: "completed", createdAt: "2026-07-31T00:00:00.000Z", designSnapshot: { id: "struct-1", name: "Spar", sections: [], loadCases: [] }, loadCaseSnapshot: { id: "load-aero", name: "Aero", source: "aerodynamic", aerodynamicResultId: "aero-1", loadFactor: 1, safetyFactor: 1.5, distributedLoads: [], pointLoads: [], status: "completed" }, materialIds: [], points: [], summary: { mass: 0, maxDeflection: 0, maxTwist: 0, minReserveFactor: 2, governingLoadCase: "Aero", governingPosition: 0, governingPlyId: "-", governingMode: "なし", reactionForce: 0, reactionMoment: 0, forceBalanceError: 0 } }],
    });

    store.updateAircraft({ sections: [rootSection, { ...tipSection, chord: 0.6 }] });

    expect(store.getDocument().structuralResults[0].status).toBe("needs-review");
  });

  it("persists coupled results and marks them for review after an aircraft edit", () => {
    const store = createDesignDocumentStore(document);
    const mesh = { nodes: [], panels: [], strips: [] };
    const coupledResult = {
      id: "aeroelastic-1",
      createdAt: "2026-08-15T00:00:00.000Z",
      status: "converged",
      reviewStatus: "current",
      aircraftSnapshot: document.aircraft,
      structuralDesignId: "spar-1",
      materialIds: ["carbon-1"],
      condition: { mode: "fixed-alpha", alphaDegrees: 4 },
      settings: { maxIterations: 50, relaxationFactor: 0.3, displacementTolerance: 1e-5, loadTolerance: 1e-5, liftTolerance: 1e-4 },
      density: 1.225,
      speed: 10,
      elasticAxisChordFraction: 0.4,
      alphaDegrees: 4,
      cl: 0.5,
      cdi: 0.02,
      cm: 0,
      totalLift: 100,
      spanLoads: [],
      structuralResult: { id: "structure-1", designId: "spar-1", loadCaseId: "load-1", status: "completed", createdAt: "2026-08-15T00:00:00.000Z", designSnapshot: { id: "spar-1", name: "Spar", sections: [], loadCases: [] }, loadCaseSnapshot: { id: "load-1", name: "Coupled", source: "aerodynamic", loadFactor: 1, safetyFactor: 1, distributedLoads: [], pointLoads: [], status: "completed" }, materialIds: ["carbon-1"], points: [], summary: { mass: 0, maxDeflection: 0, maxTwist: 0, minReserveFactor: 2, governingLoadCase: "Coupled", governingPosition: 0, governingPlyId: "-", governingMode: "なし", reactionForce: 0, reactionMoment: 0, forceBalanceError: 0 } },
      undeformedMesh: mesh,
      deformedMesh: mesh,
      iterations: [],
      warnings: [],
    } satisfies StaticAeroelasticResult;

    store.saveAeroelasticResult(coupledResult);
    expect(store.getDocument().aeroelasticResults).toMatchObject([{ id: coupledResult.id, reviewStatus: "current" }]);

    store.updateAircraft({ incidence: 1 });
    expect(store.getDocument().aeroelasticResults).toMatchObject([{ id: coupledResult.id, reviewStatus: "needs-review" }]);
  });
});
