import { describe, expect, it } from "vitest";
import { createDesignDocumentRecoveryRepository, readDesignDocumentRecoveryState, WORKING_DOCUMENT_ID } from "./designDocumentRecoveryRepository";
import { createDefaultDesignDocument } from "./defaultDesignDocument";
import { createNaca4Airfoil } from "../features/airfoils/model/airfoilGeometry";

const document = {
  schemaVersion: 6 as const,
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

  it("adds sample tails once to an older reference recovery without replacing its edits", async () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const manualTail = { ...sample.aircraft.tailSurfaces![0], id: "manual-tail", name: "手動の水平尾翼" };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: [manualTail] } },
      isDirty: true,
    }));

    const recovered = readDesignDocumentRecoveryState(storage);
    expect(recovered?.document.aircraft.tailSurfaces?.map((surface) => surface.name))
      .toEqual(["エレベーター", "ラダー", "手動の水平尾翼"]);
    expect(recovered?.isDirty).toBe(true);

    const repository = createDesignDocumentRecoveryRepository(storage);
    await repository.saveRecovery({ ...recovered!.document, aircraft: { ...recovered!.document.aircraft, tailSurfaces: [manualTail] } }, { isDirty: true });
    expect(readDesignDocumentRecoveryState(storage)?.document.aircraft.tailSurfaces?.map((surface) => surface.name))
      .toEqual(["手動の水平尾翼"]);
  });

  it("replaces the prior sample tail foil with NACA0042 in recovered projects", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const oldFoilId = "af-reference-hpa-0a";
    const nacaFoil = sample.airfoils.find((airfoil) => airfoil.name === "NACA0042")!;
    const oldTails = sample.aircraft.tailSurfaces!.map((surface) => ({
      ...surface,
      sections: surface.sections.map((section) => ({ ...section, leftAirfoilId: oldFoilId, rightAirfoilId: oldFoilId })),
    }));
    const manualTail = { ...oldTails[0], id: "manual-tail", name: "手動の水平尾翼" };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...sample,
        airfoils: sample.airfoils.filter((airfoil) => airfoil.id !== nacaFoil.id),
        polars: sample.polars.filter((polar) => polar.airfoilId !== nacaFoil.id),
        airfoilAnalysisRuns: sample.airfoilAnalysisRuns.filter((run) => !run.airfoilIds.includes(nacaFoil.id)),
        aircraft: { ...sample.aircraft, tailSurfaces: [...oldTails, manualTail] },
      },
      isDirty: false,
      sampleTailRevision: 1,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.isDirty).toBe(true);
    expect(recovered.document.airfoils.find((airfoil) => airfoil.id === nacaFoil.id)).toEqual(nacaFoil);
    expect(recovered.document.aircraft.tailSurfaces?.slice(0, 2).every((surface) =>
      surface.sections.every((section) => section.leftAirfoilId === nacaFoil.id && section.rightAirfoilId === nacaFoil.id))).toBe(true);
    expect(recovered.document.aircraft.tailSurfaces?.[2]).toEqual(manualTail);
  });

  it("adds the NACA0042 tail polars to a previously recovered reference project", async () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const nacaId = sample.airfoils.find((airfoil) => airfoil.name === "NACA0042")!.id;
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...sample,
        polars: sample.polars.filter((polar) => polar.airfoilId !== nacaId),
        airfoilAnalysisRuns: sample.airfoilAnalysisRuns.filter((run) => !run.airfoilIds.includes(nacaId)),
      },
      isDirty: false,
      sampleTailRevision: 2,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.isDirty).toBe(true);
    expect(recovered.document.polars.filter((polar) => polar.airfoilId === nacaId).map((polar) => polar.reynolds))
      .toEqual([200000, 300000, 450000, 600000]);
    expect(recovered.document.airfoilAnalysisRuns.filter((run) => run.airfoilIds.includes(nacaId))).toHaveLength(4);

    await createDesignDocumentRecoveryRepository(storage).saveRecovery({
      ...recovered.document,
      polars: recovered.document.polars.filter((polar) => polar.reynolds !== 200000),
      airfoilAnalysisRuns: recovered.document.airfoilAnalysisRuns.filter((run) => !run.id.endsWith("re200k")),
    }, { isDirty: true });
    expect(readDesignDocumentRecoveryState(storage)?.document.polars.filter((polar) => polar.airfoilId === nacaId)).toHaveLength(3);
  });

  it("updates previously recovered NACA0012 sample tails to NACA0042", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const previous = createNaca4Airfoil("0012", "af-reference-hpa-naca0012");
    const tailAirfoil = sample.airfoils.find((airfoil) => airfoil.name === "NACA0042")!;
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...sample,
        airfoils: [...sample.airfoils, previous],
        aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) => ({
          ...surface,
          sections: surface.sections.map((section) => ({ ...section, leftAirfoilId: previous.id, rightAirfoilId: previous.id })),
        })) },
      },
      isDirty: false,
      sampleTailRevision: 3,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.isDirty).toBe(true);
    expect(recovered.document.aircraft.tailSurfaces?.every((surface) => surface.sections.every((section) =>
      section.leftAirfoilId === tailAirfoil.id && section.rightAirfoilId === tailAirfoil.id))).toBe(true);
    expect(recovered.document.airfoils).toContainEqual(tailAirfoil);
  });

  it("repairs AIbis 0A on saved sample tails even when recovery is marked current", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const tailAirfoilId = sample.airfoils.find((airfoil) => airfoil.name === "NACA0042")!.id;
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...sample,
        name: "My edited reference project",
        aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) => ({
          ...surface,
          sections: surface.sections.map((section) => ({
            ...section, leftAirfoilId: "af-reference-hpa-0a", rightAirfoilId: "af-reference-hpa-0a",
          })),
        })) },
      },
      isDirty: false,
      sampleTailRevision: 4,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.name).toBe("My edited reference project");
    expect(recovered.document.aircraft.tailSurfaces?.every((surface) => surface.sections.every((section) =>
      section.leftAirfoilId === tailAirfoilId && section.rightAirfoilId === tailAirfoilId))).toBe(true);
    expect(recovered.isDirty).toBe(true);
  });

  it("updates the old rudder X location in recovered reference projects", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const revisedRudder = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-rudder")!;
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === revisedRudder.id ? { ...surface, rootPosition: { ...surface.rootPosition, x: 5.183 } } : surface) } },
      isDirty: false,
      sampleTailRevision: 4,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.tailSurfaces?.find((surface) => surface.id === revisedRudder.id)?.rootPosition.x)
      .toBe(revisedRudder.rootPosition.x);
    expect(recovered.document.analysisResults.find((result) => result.caseSnapshot?.scope === "aircraft")?.status)
      .toBe("needs-review");
    expect(recovered.isDirty).toBe(true);
  });

  it("updates the untouched sample rudder to the corrected chord and straight quarter-chord spar", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const corrected = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-rudder")!;
    const previous = {
      ...corrected,
      rootPosition: { ...corrected.rootPosition, x: 5.255 },
      sections: corrected.sections.map((section) => ({
        ...section, chord: section.spanPosition === 2.4 ? 0.76 : section.chord, xOffset: 0,
      })),
    };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === previous.id ? previous : surface) } },
      isDirty: false,
      sampleTailRevision: 4,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.tailSurfaces?.find((surface) => surface.id === corrected.id)).toEqual(corrected);
    expect(recovered.document.analysisResults.find((result) => result.caseSnapshot?.scope === "aircraft")?.status)
      .toBe("completed");
    expect(recovered.isDirty).toBe(true);
  });

  it("preserves an edited rudder while recovering an older sample revision", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const rudder = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-rudder")!;
    const edited = {
      ...rudder,
      name: "My rudder",
      rootPosition: { ...rudder.rootPosition, x: 5.255 },
      sections: rudder.sections.map((section) => ({
        ...section, chord: section.spanPosition === 2.4 ? 0.76 : section.chord, xOffset: 0,
      })),
    };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === rudder.id ? edited : surface) } },
      isDirty: true,
      sampleTailRevision: 4,
    }));

    expect(readDesignDocumentRecoveryState(storage)?.document.aircraft.tailSurfaces?.find((surface) => surface.id === rudder.id))
      .toEqual(edited);
  });

  it("updates the untouched sample elevator to a straight quarter-chord spar", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const corrected = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-elevator")!;
    const previous = {
      ...corrected,
      rootPosition: { ...corrected.rootPosition, x: 4.339 },
      sections: corrected.sections.map((section) => ({ ...section, xOffset: 0 })),
    };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === previous.id ? previous : surface) } },
      isDirty: false,
      sampleTailRevision: 5,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.tailSurfaces?.find((surface) => surface.id === corrected.id)).toEqual(corrected);
    expect(recovered.document.analysisResults.find((result) => result.caseSnapshot?.scope === "aircraft")?.status)
      .toBe("completed");
    expect(recovered.isDirty).toBe(true);
  });

  it("preserves an edited elevator when upgrading the sample", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const elevator = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-elevator")!;
    const edited = {
      ...elevator, name: "My elevator", rootPosition: { ...elevator.rootPosition, x: 4.339 },
      sections: elevator.sections.map((section) => ({ ...section, xOffset: 0 })),
    };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === edited.id ? edited : surface) } },
      isDirty: true,
      sampleTailRevision: 5,
    }));

    expect(readDesignDocumentRecoveryState(storage)?.document.aircraft.tailSurfaces?.find((surface) => surface.id === edited.id))
      .toEqual(edited);
  });

  it("adds explicit spar positions to a previously saved untouched sample", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const { sparChordFraction: _wingSpar, ...oldAircraft } = sample.aircraft;
    const previousAircraft = { ...oldAircraft, tailSurfaces: sample.aircraft.tailSurfaces?.map(({ sparChordFraction: _tailSpar, ...surface }) => surface) };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: previousAircraft, analysisResults: sample.analysisResults.map((result) =>
        result.caseId === "reference-hpa-whole-aircraft-tail-vlm" ? { ...result, aircraftSnapshot: previousAircraft } : result) },
      isDirty: false,
      sampleTailRevision: 6,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.sparChordFraction).toBe(0.35);
    expect(recovered.document.aircraft.tailSurfaces?.map((surface) => surface.sparChordFraction)).toEqual([0.25, 0.25]);
    expect(recovered.document.analysisResults.find((result) => result.caseId === "reference-hpa-whole-aircraft-tail-vlm")?.aircraftSnapshot)
      .toEqual(recovered.document.aircraft);
    expect(recovered.isDirty).toBe(true);
  });

  it("preserves customized spar positions when upgrading the sample", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const customized = { ...sample.aircraft, sparChordFraction: 0.3, tailSurfaces: sample.aircraft.tailSurfaces?.map((surface) =>
      surface.id === "reference-hpa-elevator" ? { ...surface, sparChordFraction: 0.4 } : surface) };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: customized },
      isDirty: true,
      sampleTailRevision: 6,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.sparChordFraction).toBe(0.3);
    expect(recovered.document.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-elevator")?.sparChordFraction).toBe(0.4);
  });

  it("updates an untouched 25% main-wing spar in a saved sample to the 5-degree pressure-center estimate", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, sparChordFraction: 0.25 } },
      isDirty: false,
      sampleTailRevision: 7,
    }));

    const recovered = readDesignDocumentRecoveryState(storage)!;
    expect(recovered.document.aircraft.sparChordFraction).toBe(0.35);
    expect(recovered.document.aircraft.tailSurfaces).toEqual(sample.aircraft.tailSurfaces);
    expect(recovered.isDirty).toBe(true);
  });

  it("does not overwrite a customized spar position on the previous elevator geometry", () => {
    const storage = new MemoryStorage();
    const sample = createDefaultDesignDocument();
    const elevator = sample.aircraft.tailSurfaces!.find((surface) => surface.id === "reference-hpa-elevator")!;
    const edited = { ...elevator, sparChordFraction: 0.4, rootPosition: { ...elevator.rootPosition, x: 4.339 },
      sections: elevator.sections.map((section) => ({ ...section, xOffset: 0 })) };
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: sample.aircraft.tailSurfaces!.map((surface) =>
        surface.id === edited.id ? edited : surface) } },
      isDirty: true,
      sampleTailRevision: 6,
    }));

    expect(readDesignDocumentRecoveryState(storage)?.document.aircraft.tailSurfaces?.find((surface) => surface.id === edited.id))
      .toEqual(edited);
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
      document: { schemaVersion: 6, aircraft: { sections: [expect.objectContaining({ yPosition: 0 }), expect.objectContaining({ yPosition: 2 })] } },
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
