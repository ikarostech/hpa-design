import { describe, expect, it } from "vitest";
import { createDesignDocumentRecoveryRepository, readDesignDocumentRecoveryState, WORKING_DOCUMENT_ID } from "./designDocumentRecoveryRepository";

const document = {
  schemaVersion: 5 as const,
  name: "Recovered Glider",
  airfoils: [],
  polars: [],
  airfoilAnalysisRuns: [],
  aircraft: {
    id: "geo-1",
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
  carbonMaterials: [],
  structuralDesigns: [],
  structuralResults: [],
};

describe("design document recovery repository", () => {
  it("restores the latest valid working document", async () => {
    const storage = new MemoryStorage();
    const repository = createDesignDocumentRecoveryRepository(storage);

    await repository.save(document);

    expect(await repository.get(WORKING_DOCUMENT_ID)).toEqual(document);
  });

  it("preserves whether the recovered document was already exported", async () => {
    const storage = new MemoryStorage();
    const repository = createDesignDocumentRecoveryRepository(storage);

    await repository.saveRecovery(document, { isDirty: false });

    expect(readDesignDocumentRecoveryState(storage)).toEqual({ document, isDirty: false });
  });

  it("migrates a recovered version 1 wing document", () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...document,
        schemaVersion: 1,
        airfoils: [{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [{ x: 0, upper: 0, lower: 0 }, { x: 0.5, upper: 0.1, lower: -0.1 }, { x: 1, upper: 0, lower: 0 }] }],
        aircraft: { ...document.aircraft, sections: [
          { id: "root", spanPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
          { id: "tip", spanPosition: 2, chord: 0.5, twist: -2, dihedral: 0, airfoilId: "af-1", controlSurface: "none" },
        ] },
      },
      isDirty: true,
    }));

    expect(readDesignDocumentRecoveryState(storage)).toMatchObject({
      document: { schemaVersion: 5, aircraft: { sections: [expect.objectContaining({ yPosition: 0 }), expect.objectContaining({ yPosition: 2 })] } },
      isDirty: true,
    });
  });

  it("discards malformed recovery data instead of returning it", async () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKING_DOCUMENT_ID, '{"schemaVersion":1,"name":"Broken"}');
    const repository = createDesignDocumentRecoveryRepository(storage);

    expect(await repository.get(WORKING_DOCUMENT_ID)).toBeNull();
    expect(storage.getItem(WORKING_DOCUMENT_ID)).toBeNull();
  });

  it("discards recovery data that cannot be parsed", async () => {
    const storage = new MemoryStorage();
    storage.setItem(WORKING_DOCUMENT_ID, "not JSON");
    const repository = createDesignDocumentRecoveryRepository(storage);

    expect(await repository.get(WORKING_DOCUMENT_ID)).toBeNull();
    expect(storage.getItem(WORKING_DOCUMENT_ID)).toBeNull();
  });

  it("treats inaccessible browser storage as no recovery data", () => {
    expect(readDesignDocumentRecoveryState(new UnavailableStorage())).toBeNull();
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class UnavailableStorage extends MemoryStorage {
  override getItem(_key: string): string | null { throw new Error("Storage is unavailable"); }
  override removeItem(_key: string): void { throw new Error("Storage is unavailable"); }
}
