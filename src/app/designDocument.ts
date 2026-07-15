import type { AircraftGeometry } from "../features/aircraft/model/types";
import { applyAircraftDraft, createAircraftDraft } from "../features/aircraft/model/aircraftDraft";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../features/airfoils/model/types";

export interface DesignDocument {
  schemaVersion: 1;
  name: string;
  airfoils: readonly Airfoil[];
  polars: readonly AirfoilPolar[];
  airfoilAnalysisRuns: readonly AirfoilAnalysisRun[];
  aircraft: AircraftGeometry;
  analysisCases: readonly AnalysisCase[];
  analysisResults: readonly AnalysisResult[];
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
}

export interface DesignDocumentState {
  revision: number;
  savedRevision: number;
  isDirty: boolean;
}

type EditableAircraftGeometry = Pick<AircraftGeometry, "span" | "rootChord" | "tipChord" | "twist" | "dihedral" | "sweep" | "incidence" | "sections" | "staticMargin">;

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
        const exists = document.airfoils.some((item) => item.id === airfoil.id);
        document = { ...document, airfoils: exists ? document.airfoils.map((item) => item.id === airfoil.id ? cloneAirfoil(airfoil) : item) : [cloneAirfoil(airfoil), ...document.airfoils] };
      });
    },
    removeAirfoil: (airfoilId) => update(() => { document = { ...document, airfoils: document.airfoils.filter((airfoil) => airfoil.id !== airfoilId) }; }),
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
      const nextAircraft = { ...document.aircraft, ...patch, sections: patch.sections ?? document.aircraft.sections };
      document = { ...document, aircraft: applyAircraftDraft(createAircraftDraft(nextAircraft), document.aircraft) };
    }),
    saveAirfoilAnalysis: (run, polars) => {
      update(() => { document = { ...document, airfoilAnalysisRuns: [cloneRun(run), ...document.airfoilAnalysisRuns], polars: [...polars.map(clonePolar), ...document.polars] }; });
    },
  };
}

function cloneDocument(document: DesignDocument): DesignDocument {
  return { ...document, airfoils: document.airfoils.map(cloneAirfoil), polars: document.polars.map(clonePolar), airfoilAnalysisRuns: document.airfoilAnalysisRuns.map(cloneRun), aircraft: cloneAircraft(document.aircraft), analysisCases: document.analysisCases.map((analysisCase) => ({ ...analysisCase })), analysisResults: document.analysisResults.map(cloneAnalysisResult) };
}

function cloneAirfoil(airfoil: Airfoil): Airfoil { return { ...airfoil, coordinates: airfoil.coordinates.map((point) => ({ ...point })) }; }
function clonePolar(polar: AirfoilPolar): AirfoilPolar { return { ...polar, points: polar.points.map((point) => ({ ...point })) }; }
function cloneRun(run: AirfoilAnalysisRun): AirfoilAnalysisRun { return { ...run, airfoilIds: [...run.airfoilIds], polarIds: [...run.polarIds] }; }
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
