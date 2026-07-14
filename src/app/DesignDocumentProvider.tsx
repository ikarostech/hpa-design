import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../features/airfoils/model/types";
import { aircraftGeometry, airfoilPolars, airfoils, analysisCases, analysisResult } from "../mocks/mockData";
import type { EntityRepository } from "../shared/model";
import { createDesignDocumentStore, type DesignDocument, type DesignDocumentStore } from "./designDocument";

interface DesignDocumentContextValue {
  getDocument: () => DesignDocument;
  replaceDocument: (document: DesignDocument) => void;
  saveAirfoil: (airfoil: Airfoil) => void;
  removeAirfoil: (airfoilId: string) => void;
  updateAircraft: (patch: Partial<AircraftGeometry>) => void;
  saveAirfoilAnalysis: (run: AirfoilAnalysisRun, polars: readonly AirfoilPolar[]) => void;
}

const DesignDocumentContext = createContext<DesignDocumentContextValue | null>(null);

const initialAnalysisRuns: AirfoilAnalysisRun[] = [{
  id: "run-initial-polars",
  name: "初期 Polar 解析",
  airfoilIds: Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))),
  polarIds: airfoilPolars.map((polar) => polar.id),
  createdAt: "2026-06-21T00:00:00.000Z",
  reynolds: 300000,
  mach: 0.04,
  alphaStart: -6,
  alphaEnd: 18,
  alphaStep: 2,
  status: "complete",
}];

export function DesignDocumentProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<DesignDocumentStore | null>(null);
  const [, setRevision] = useState(0);
  if (!storeRef.current) {
    storeRef.current = createDesignDocumentStore({
      schemaVersion: 1,
      name: "LongRange UAV",
      airfoils,
      polars: airfoilPolars,
      airfoilAnalysisRuns: initialAnalysisRuns,
      aircraft: aircraftGeometry,
      analysisCases,
      analysisResults: [analysisResult],
    });
  }

  const commit = useCallback((change: (store: DesignDocumentStore) => void) => {
    change(storeRef.current!);
    setRevision((revision) => revision + 1);
  }, []);

  const value: DesignDocumentContextValue = {
    getDocument: () => storeRef.current!.getDocument(),
    replaceDocument: (document) => commit((store) => store.replaceDocument(document)),
    saveAirfoil: (airfoil) => commit((store) => store.saveAirfoil(airfoil)),
    removeAirfoil: (airfoilId) => commit((store) => store.removeAirfoil(airfoilId)),
    updateAircraft: (patch) => commit((store) => store.updateAircraft(patch)),
    saveAirfoilAnalysis: (run, polars) => commit((store) => store.saveAirfoilAnalysis(run, polars)),
  };

  return <DesignDocumentContext.Provider value={value}>{children}</DesignDocumentContext.Provider>;
}

export function useDesignDocument() {
  const context = useContext(DesignDocumentContext);
  if (!context) {
    throw new Error("useDesignDocument must be used within DesignDocumentProvider");
  }

  return {
    document: context.getDocument(),
    replaceDocument: context.replaceDocument,
    airfoilRepository: createAirfoilRepository(context),
    updateAircraft: context.updateAircraft,
    saveAirfoilAnalysis: context.saveAirfoilAnalysis,
  };
}

function createAirfoilRepository(context: DesignDocumentContextValue): EntityRepository<Airfoil, string> {
  return {
    list: async () => context.getDocument().airfoils,
    get: async (id) => context.getDocument().airfoils.find((airfoil) => airfoil.id === id) ?? null,
    save: async (airfoil) => {
      context.saveAirfoil(airfoil);
      return airfoil;
    },
    remove: async (id) => context.removeAirfoil(id),
  };
}
