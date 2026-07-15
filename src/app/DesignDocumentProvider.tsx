import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../features/airfoils/model/types";
import { aircraftGeometry, airfoilPolars, airfoils, analysisCases, analysisResult } from "../mocks/mockData";
import type { EntityRepository } from "../shared/model";
import { createDesignDocumentStore, type DesignDocument, type DesignDocumentStore } from "./designDocument";
import { createDesignDocumentRecoveryRepository, readDesignDocumentRecoveryState, type DesignDocumentRecoveryRepository } from "./designDocumentRecoveryRepository";

interface DesignDocumentContextValue {
  getDocument: () => DesignDocument;
  isDirty: boolean;
  markDocumentSaved: () => void;
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
  const recoveryRepositoryRef = useRef<DesignDocumentRecoveryRepository | null>(null);
  const [, setRenderRevision] = useState(0);
  if (!storeRef.current) {
    const storage = getBrowserStorage();
    const recoveredDocument = storage ? readDesignDocumentRecoveryState(storage) : null;
    storeRef.current = createDesignDocumentStore(recoveredDocument?.document ?? {
      schemaVersion: 1,
      name: "LongRange UAV",
      airfoils,
      polars: airfoilPolars,
      airfoilAnalysisRuns: initialAnalysisRuns,
      aircraft: aircraftGeometry,
      analysisCases,
      analysisResults: [analysisResult],
    }, { saved: !recoveredDocument?.isDirty });
    recoveryRepositoryRef.current = storage ? createDesignDocumentRecoveryRepository(storage) : null;
  }

  const commit = useCallback((change: (store: DesignDocumentStore) => void) => {
    change(storeRef.current!);
    void recoveryRepositoryRef.current?.saveRecovery(storeRef.current!.getDocument(), { isDirty: true }).catch(() => undefined);
    setRenderRevision((revision) => revision + 1);
  }, []);

  const markDocumentSaved = useCallback(() => {
    storeRef.current!.markSaved();
    void recoveryRepositoryRef.current?.saveRecovery(storeRef.current!.getDocument(), { isDirty: false }).catch(() => undefined);
    setRenderRevision((revision) => revision + 1);
  }, []);

  const replaceDocument = useCallback((document: DesignDocument) => {
    storeRef.current!.replaceDocument(document);
    void recoveryRepositoryRef.current?.saveRecovery(storeRef.current!.getDocument(), { isDirty: false }).catch(() => undefined);
    setRenderRevision((revision) => revision + 1);
  }, []);

  const isDirty = storeRef.current.getState().isDirty;

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const value: DesignDocumentContextValue = {
    getDocument: () => storeRef.current!.getDocument(),
    isDirty,
    markDocumentSaved,
    replaceDocument,
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
    isDirty: context.isDirty,
    markDocumentSaved: context.markDocumentSaved,
    replaceDocument: context.replaceDocument,
    airfoilRepository: createAirfoilRepository(context),
    updateAircraft: context.updateAircraft,
    saveAirfoilAnalysis: context.saveAirfoilAnalysis,
  };
}

function getBrowserStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
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
