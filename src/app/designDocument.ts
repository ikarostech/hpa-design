import type { AircraftGeometry } from "../features/aircraft/model/types";
import { applyAircraftDraft, createAircraftDraft } from "../features/aircraft/model/aircraftDraft";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../features/airfoils/model/types";
import type { CarbonMaterial, StructuralAnalysisResult, StructuralDesign } from "../features/structures/model/types";

export interface DesignDocument {
  schemaVersion: 4;
  name: string;
  airfoils: readonly Airfoil[];
  polars: readonly AirfoilPolar[];
  airfoilAnalysisRuns: readonly AirfoilAnalysisRun[];
  aircraft: AircraftGeometry;
  analysisCases: readonly AnalysisCase[];
  analysisResults: readonly AnalysisResult[];
  carbonMaterials: readonly CarbonMaterial[];
  structuralDesigns: readonly StructuralDesign[];
  structuralResults: readonly StructuralAnalysisResult[];
}

export interface DesignDocumentStore {
  getDocument: () => DesignDocument;
  getState: () => DesignDocumentState;
  markSaved: () => void;
  replaceDocument: (document: DesignDocument) => void;
  saveAirfoil: (airfoil: Airfoil) => void;
  removeAirfoil: (airfoilId: string) => void;
  saveAnalysisCase: (analysisCase: AnalysisCase) => void;
  removeAnalysisCase: (analysisCaseId: string) => void;
  saveAnalysisResult: (result: AnalysisResult) => void;
  updateAircraft: (patch: Partial<EditableAircraftGeometry>) => void;
  saveAirfoilAnalysis: (run: AirfoilAnalysisRun, polars: readonly AirfoilPolar[]) => void;
  updateAirfoilAnalysisRun: (run: AirfoilAnalysisRun) => void;
  removeAirfoilAnalysisRun: (runId: string) => void;
  saveCarbonMaterial: (material: CarbonMaterial) => void;
  removeCarbonMaterial: (materialId: string) => void;
  saveStructuralDesign: (design: StructuralDesign) => void;
  removeStructuralDesign: (designId: string) => void;
  saveStructuralResult: (result: StructuralAnalysisResult) => void;
}

export interface DesignDocumentState {
  revision: number;
  savedRevision: number;
  isDirty: boolean;
}

export class AirfoilReferenceError extends Error {
  readonly references: readonly string[];

  constructor(references: readonly string[]) {
    super(`Airfoil is used by ${references.length} saved item(s): ${references.join(", ")}`);
    this.name = "AirfoilReferenceError";
    this.references = references;
  }
}

type EditableAircraftGeometry = Pick<AircraftGeometry, "incidence" | "sections" | "staticMargin">;

export function createDesignDocumentStore(initialDocument: DesignDocument, { saved = true }: { saved?: boolean } = {}): DesignDocumentStore {
  let document = cloneDocument(initialDocument);
  let revision = 0;
  let savedRevision = saved ? 0 : -1;

  const update = (change: () => void) => {
    change();
    revision += 1;
  };

  return {
    getDocument: () => cloneDocument(document),
    getState: () => ({ revision, savedRevision, isDirty: revision !== savedRevision }),
    markSaved: () => { savedRevision = revision; },
    replaceDocument: (nextDocument) => {
      update(() => { document = cloneDocument(nextDocument); });
      savedRevision = revision;
    },
    saveAirfoil: (airfoil) => {
      update(() => {
        const previous = document.airfoils.find((item) => item.id === airfoil.id);
        const coordinatesChanged = previous ? !sameCoordinates(previous, airfoil) : false;
        const exists = Boolean(previous);
        document = {
          ...document,
          airfoils: exists ? document.airfoils.map((item) => item.id === airfoil.id ? cloneAirfoil(airfoil) : item) : [cloneAirfoil(airfoil), ...document.airfoils],
          polars: coordinatesChanged ? document.polars.map((polar) => polar.airfoilId === airfoil.id ? { ...polar, status: "needs-review" } : polar) : document.polars,
          airfoilAnalysisRuns: coordinatesChanged ? document.airfoilAnalysisRuns.map((run) => run.airfoilIds.includes(airfoil.id) ? { ...run, status: "needs-review" } : run) : document.airfoilAnalysisRuns,
          analysisResults: coordinatesChanged ? document.analysisResults.map((result) => result.airfoilIds?.includes(airfoil.id)
            ? { ...result, status: "needs-review", rows: result.rows.map((row) => ({ ...row, status: "needs-review" })) }
            : result) : document.analysisResults,
        };
      });
    },
    removeAirfoil: (airfoilId) => update(() => {
      const references = listAirfoilReferences(document, airfoilId);
      if (references.length) throw new AirfoilReferenceError(references);
      document = { ...document, airfoils: document.airfoils.filter((airfoil) => airfoil.id !== airfoilId) };
    }),
    saveAnalysisCase: (analysisCase) => update(() => {
      const previous = document.analysisCases.find((item) => item.id === analysisCase.id);
      const exists = Boolean(previous);
      const inputsChanged = previous ? analysisInputsChanged(previous, analysisCase) : false;
      document = {
        ...document,
        analysisCases: exists
          ? document.analysisCases.map((item) => item.id === analysisCase.id ? { ...analysisCase } : item)
          : [{ ...analysisCase }, ...document.analysisCases],
        analysisResults: inputsChanged
          ? document.analysisResults.map((result) => result.caseId === analysisCase.id
            ? { ...result, status: "needs-review", rows: result.rows.map((row) => ({ ...row, status: "needs-review" })) }
            : result)
          : document.analysisResults,
      };
    }),
    removeAnalysisCase: (analysisCaseId) => update(() => {
      document = {
        ...document,
        analysisCases: document.analysisCases.filter((analysisCase) => analysisCase.id !== analysisCaseId),
        analysisResults: document.analysisResults.filter((result) => result.caseId !== analysisCaseId),
      };
    }),
    saveAnalysisResult: (result) => update(() => {
      document = {
        ...document,
        analysisCases: document.analysisCases.map((analysisCase) => analysisCase.id === result.caseId ? { ...analysisCase, status: result.status } : analysisCase),
        analysisResults: [cloneAnalysisResult(result), ...document.analysisResults.filter((item) => item.caseId !== result.caseId)],
      };
    }),
    updateAircraft: (patch) => update(() => {
      const previousAircraft = document.aircraft;
      const nextAircraft = { ...document.aircraft, ...patch, sections: patch.sections ?? document.aircraft.sections };
      const aircraft = applyAircraftDraft(createAircraftDraft(nextAircraft), document.aircraft);
      const geometryChanged = aircraftAnalysisInputsChanged(previousAircraft, aircraft);
      const affectedCaseIds = new Set(document.analysisCases.filter((analysisCase) => analysisCase.geometryId === aircraft.id).map((analysisCase) => analysisCase.id));
      document = {
        ...document,
        aircraft,
        analysisCases: geometryChanged ? document.analysisCases.map((analysisCase) => affectedCaseIds.has(analysisCase.id) ? { ...analysisCase, status: "needs-review" } : analysisCase) : document.analysisCases,
        analysisResults: geometryChanged ? document.analysisResults.map((result) => affectedCaseIds.has(result.caseId)
          ? { ...result, status: "needs-review", rows: result.rows.map((row) => ({ ...row, status: "needs-review" })) }
          : result) : document.analysisResults,
        structuralResults: geometryChanged ? document.structuralResults.map((result) => result.loadCaseSnapshot.source === "aerodynamic" ? { ...result, status: "needs-review" } : result) : document.structuralResults,
      };
    }),
    saveAirfoilAnalysis: (run, polars) => {
      update(() => { document = { ...document, airfoilAnalysisRuns: [cloneRun(run), ...document.airfoilAnalysisRuns], polars: [...polars.map(clonePolar), ...document.polars] }; });
    },
    updateAirfoilAnalysisRun: (run) => update(() => {
      document = { ...document, airfoilAnalysisRuns: document.airfoilAnalysisRuns.map((item) => item.id === run.id ? cloneRun(run) : item) };
    }),
    removeAirfoilAnalysisRun: (runId) => update(() => {
      const removedRun = document.airfoilAnalysisRuns.find((run) => run.id === runId);
      if (!removedRun) return;
      const remainingRuns = document.airfoilAnalysisRuns.filter((run) => run.id !== runId);
      const retainedPolarIds = new Set([...remainingRuns.flatMap((run) => run.polarIds), ...document.analysisResults.flatMap((result) => result.polarIds ?? [])]);
      document = { ...document, airfoilAnalysisRuns: remainingRuns, polars: document.polars.filter((polar) => !removedRun.polarIds.includes(polar.id) || retainedPolarIds.has(polar.id)) };
    }),
    saveCarbonMaterial: (material) => update(() => {
      const previous = document.carbonMaterials.find((item) => item.id === material.id);
      const changed = previous ? JSON.stringify(previous) !== JSON.stringify(material) : false;
      document = {
        ...document,
        carbonMaterials: previous ? document.carbonMaterials.map((item) => item.id === material.id ? { ...material } : item) : [{ ...material }, ...document.carbonMaterials],
        structuralResults: changed ? document.structuralResults.map((result) => result.materialIds.includes(material.id) ? { ...result, status: "needs-review" } : result) : document.structuralResults,
      };
    }),
    removeCarbonMaterial: (materialId) => update(() => {
      const referenced = document.structuralDesigns.some((design) => design.sections.some((section) => section.plies.some((ply) => ply.materialId === materialId)));
      if (referenced) throw new Error("材料は構造設計で参照されているため削除できません。");
      document = { ...document, carbonMaterials: document.carbonMaterials.filter((material) => material.id !== materialId) };
    }),
    saveStructuralDesign: (design) => update(() => {
      const previous = document.structuralDesigns.find((item) => item.id === design.id);
      const changed = previous ? JSON.stringify(previous) !== JSON.stringify(design) : false;
      document = {
        ...document,
        structuralDesigns: previous ? document.structuralDesigns.map((item) => item.id === design.id ? cloneStructuralDesign(design) : item) : [cloneStructuralDesign(design), ...document.structuralDesigns],
        structuralResults: changed ? document.structuralResults.map((result) => result.designId === design.id ? { ...result, status: "needs-review" } : result) : document.structuralResults,
      };
    }),
    removeStructuralDesign: (designId) => update(() => {
      document = { ...document, structuralDesigns: document.structuralDesigns.filter((design) => design.id !== designId), structuralResults: document.structuralResults.filter((result) => result.designId !== designId) };
    }),
    saveStructuralResult: (result) => update(() => {
      document = {
        ...document,
        structuralDesigns: document.structuralDesigns.map((design) => design.id !== result.designId ? design : { ...design, loadCases: design.loadCases.map((loadCase) => loadCase.id === result.loadCaseId ? { ...loadCase, status: result.status } : loadCase) }),
        structuralResults: [cloneStructuralResult(result), ...document.structuralResults.filter((item) => item.designId !== result.designId || item.loadCaseId !== result.loadCaseId)],
      };
    }),
  };
}

function cloneDocument(document: DesignDocument): DesignDocument {
  return { ...document, airfoils: document.airfoils.map(cloneAirfoil), polars: document.polars.map(clonePolar), airfoilAnalysisRuns: document.airfoilAnalysisRuns.map(cloneRun), aircraft: cloneAircraft(document.aircraft), analysisCases: document.analysisCases.map((analysisCase) => ({ ...analysisCase })), analysisResults: document.analysisResults.map(cloneAnalysisResult), carbonMaterials: document.carbonMaterials.map((material) => ({ ...material })), structuralDesigns: document.structuralDesigns.map(cloneStructuralDesign), structuralResults: document.structuralResults.map(cloneStructuralResult) };
}

function cloneAirfoil(airfoil: Airfoil): Airfoil { return { ...airfoil, coordinates: airfoil.coordinates.map((point) => ({ ...point })) }; }
function clonePolar(polar: AirfoilPolar): AirfoilPolar { return { ...polar, points: polar.points.map((point) => ({ ...point })) }; }
function cloneRun(run: AirfoilAnalysisRun): AirfoilAnalysisRun { return { ...run, airfoilIds: [...run.airfoilIds], polarIds: [...run.polarIds], failures: run.failures?.map((failure) => ({ ...failure })) }; }
function cloneAircraft(aircraft: AircraftGeometry): AircraftGeometry { return { ...aircraft, sections: aircraft.sections.map((section) => ({ ...section })) }; }
function cloneAnalysisResult(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    caseSnapshot: result.caseSnapshot ? { ...result.caseSnapshot } : undefined,
    aircraftSnapshot: result.aircraftSnapshot ? cloneAircraft(result.aircraftSnapshot) : undefined,
    airfoilIds: result.airfoilIds ? [...result.airfoilIds] : undefined,
    polarIds: result.polarIds ? [...result.polarIds] : undefined,
    rows: result.rows.map((row) => ({ ...row })),
  };
}

function cloneStructuralDesign(design: StructuralDesign): StructuralDesign {
  return { ...design, sections: design.sections.map((section) => ({ ...section, plies: section.plies.map((ply) => ({ ...ply })) })), loadCases: design.loadCases.map((loadCase) => ({ ...loadCase, distributedLoads: loadCase.distributedLoads.map((load) => ({ ...load })), pointLoads: loadCase.pointLoads.map((load) => ({ ...load })) })), supports: design.supports?.map((support) => ({ ...support })) };
}

function cloneStructuralResult(result: StructuralAnalysisResult): StructuralAnalysisResult {
  return { ...result, designSnapshot: cloneStructuralDesign(result.designSnapshot), loadCaseSnapshot: { ...result.loadCaseSnapshot, distributedLoads: result.loadCaseSnapshot.distributedLoads.map((load) => ({ ...load })), pointLoads: result.loadCaseSnapshot.pointLoads.map((load) => ({ ...load })) }, materialIds: [...result.materialIds], materialSnapshots: result.materialSnapshots?.map((material) => ({ ...material })), points: result.points.map((point) => ({ ...point })), summary: { ...result.summary } };
}

function analysisInputsChanged(left: AnalysisCase, right: AnalysisCase) {
  return left.name !== right.name
    || left.method !== right.method
    || left.alphaStart !== right.alphaStart
    || left.alphaEnd !== right.alphaEnd
    || left.alphaStep !== right.alphaStep
    || left.speed !== right.speed
    || left.altitude !== right.altitude
    || left.reynolds !== right.reynolds
    || left.geometryId !== right.geometryId;
}

function aircraftAnalysisInputsChanged(left: AircraftGeometry, right: AircraftGeometry) {
  return left.incidence !== right.incidence || JSON.stringify(left.sections) !== JSON.stringify(right.sections);
}

function sameCoordinates(left: Airfoil, right: Airfoil) {
  return left.coordinates.length === right.coordinates.length
    && left.coordinates.every((point, index) => point.x === right.coordinates[index]?.x && point.upper === right.coordinates[index]?.upper && point.lower === right.coordinates[index]?.lower);
}

export function listAirfoilReferences(document: DesignDocument, airfoilId: string) {
  return [
    ...document.aircraft.sections.filter((section) => section.airfoilId === airfoilId).map((section) => `aircraft section ${section.id}`),
    ...document.polars.filter((polar) => polar.airfoilId === airfoilId).map((polar) => `Polar ${polar.id}`),
    ...document.airfoilAnalysisRuns.filter((run) => run.airfoilIds.includes(airfoilId)).map((run) => `airfoil run ${run.id}`),
    ...document.analysisResults.filter((result) => result.airfoilIds?.includes(airfoilId)).map((result) => `aircraft result ${result.id}`),
  ];
}
