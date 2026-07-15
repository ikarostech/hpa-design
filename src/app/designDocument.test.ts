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
});
