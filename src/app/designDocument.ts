import type { AircraftGeometry } from "../features/aircraft/model/types";
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
    updateAircraft: (patch) => update(() => { document = { ...document, aircraft: deriveAircraftGeometry({ ...document.aircraft, ...patch }) }; }),
    saveAirfoilAnalysis: (run, polars) => {
      update(() => { document = { ...document, airfoilAnalysisRuns: [cloneRun(run), ...document.airfoilAnalysisRuns], polars: [...polars.map(clonePolar), ...document.polars] }; });
    },
  };
}

function deriveAircraftGeometry(geometry: AircraftGeometry): AircraftGeometry {
  const taperRatio = safeDivide(geometry.tipChord, geometry.rootChord);
  const wingArea = geometry.span * (geometry.rootChord + geometry.tipChord) / 2;
  const aspectRatio = safeDivide(geometry.span ** 2, wingArea);
  const mac = geometry.rootChord > 0 ? (2 / 3) * geometry.rootChord * (1 + taperRatio + taperRatio ** 2) / (1 + taperRatio) : 0;
  return { ...geometry, taperRatio: round(taperRatio, 3), wingArea: round(wingArea, 3), aspectRatio: round(aspectRatio, 3), mac: round(mac, 3), sections: geometry.sections.map((section) => ({ ...section })) };
}

function cloneDocument(document: DesignDocument): DesignDocument {
  return { ...document, airfoils: document.airfoils.map(cloneAirfoil), polars: document.polars.map(clonePolar), airfoilAnalysisRuns: document.airfoilAnalysisRuns.map(cloneRun), aircraft: cloneAircraft(document.aircraft), analysisCases: document.analysisCases.map((analysisCase) => ({ ...analysisCase })), analysisResults: document.analysisResults.map(cloneAnalysisResult) };
}

function safeDivide(numerator: number, denominator: number) { return denominator === 0 ? 0 : numerator / denominator; }
function round(value: number, digits: number) { return Number(value.toFixed(digits)); }
function cloneAirfoil(airfoil: Airfoil): Airfoil { return { ...airfoil, coordinates: airfoil.coordinates.map((point) => ({ ...point })) }; }
function clonePolar(polar: AirfoilPolar): AirfoilPolar { return { ...polar, points: polar.points.map((point) => ({ ...point })) }; }
function cloneRun(run: AirfoilAnalysisRun): AirfoilAnalysisRun { return { ...run, airfoilIds: [...run.airfoilIds], polarIds: [...run.polarIds] }; }
function cloneAircraft(aircraft: AircraftGeometry): AircraftGeometry { return { ...aircraft, sections: aircraft.sections.map((section) => ({ ...section })) }; }
function cloneAnalysisResult(result: AnalysisResult): AnalysisResult { return { ...result, rows: result.rows.map((row) => ({ ...row })) }; }
