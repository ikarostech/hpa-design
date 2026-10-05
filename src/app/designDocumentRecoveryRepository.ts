import type { EntityRepository } from "../shared/model";
import type { DesignDocument } from "./designDocument";
import type { TailSurface } from "../features/aircraft/model/types";
import { createDefaultDesignDocument } from "./defaultDesignDocument";
import { migrateDesignDocument, validateDesignDocument } from "./designDocumentTransfer";

export const WORKING_DOCUMENT_ID = "hpa-design:working-document";
const SAMPLE_TAIL_REVISION = 8;
const PREVIOUS_TAIL_AIRFOIL_IDS = new Set(["af-reference-hpa-0a", "af-reference-hpa-naca0012"]);

export interface RecoveredDesignDocument {
  document: DesignDocument;
  isDirty: boolean;
}

export type DesignDocumentRecoveryRepository = EntityRepository<DesignDocument, string> & {
  saveRecovery: (document: DesignDocument, state: Pick<RecoveredDesignDocument, "isDirty">) => Promise<DesignDocument>;
};

export function createDesignDocumentRecoveryRepository(storage: Storage): DesignDocumentRecoveryRepository {
  const saveRecovery = async (document: DesignDocument, state: Pick<RecoveredDesignDocument, "isDirty">) => {
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({ document, isDirty: state.isDirty, sampleTailRevision: SAMPLE_TAIL_REVISION }));
    return document;
  };

  return {
    list: async () => {
      const recovered = readDesignDocumentRecoveryState(storage);
      return recovered ? [recovered.document] : [];
    },
    get: async (id) => id === WORKING_DOCUMENT_ID ? readDesignDocumentRecoveryState(storage)?.document ?? null : null,
    save: async (document) => saveRecovery(document, { isDirty: true }),
    remove: async (id) => {
      if (id === WORKING_DOCUMENT_ID) storage.removeItem(WORKING_DOCUMENT_ID);
    },
    saveRecovery,
  };
}

export function readDesignDocumentRecovery(storage: Storage): DesignDocument | null {
  return readDesignDocumentRecoveryState(storage)?.document ?? null;
}

export function readDesignDocumentRecoveryState(storage: Storage): RecoveredDesignDocument | null {
  try {
    const content = storage.getItem(WORKING_DOCUMENT_ID);
    if (!content) return null;
    const value: unknown = JSON.parse(content);
    const recovered = toRecoveredDocument(value);
    if (!recovered) return discardRecovery(storage);
    const document = migrateDesignDocument(recovered.document);
    if (!validateDesignDocument(document).valid) return discardRecovery(storage);
    const current = document as DesignDocument;
    if (current.aircraft.id !== "reference-hpa-main-wing") return { document: current, isDirty: recovered.isDirty };
    const sample = createDefaultDesignDocument();
    const sampleTailIds = new Set((sample.aircraft.tailSurfaces ?? []).map((surface) => surface.id));
    const canUpgradeWingSpar = (current.aircraft.sparChordFraction === undefined || current.aircraft.sparChordFraction === 0.25)
      && JSON.stringify({ ...current.aircraft, sparChordFraction: undefined, tailSurfaces: undefined })
        === JSON.stringify({ ...sample.aircraft, sparChordFraction: undefined, tailSurfaces: undefined });
    const tailSparUpgradeIds = new Set((current.aircraft.tailSurfaces ?? []).filter((surface) => {
      const sampleSurface = sample.aircraft.tailSurfaces?.find((item) => item.id === surface.id);
      return surface.sparChordFraction === undefined && sampleSurface
        && sameWithoutSparPosition(surface, sampleSurface);
    }).map((surface) => surface.id));
    const sparPositionsChanged = canUpgradeWingSpar || tailSparUpgradeIds.size > 0;
    const hasLegacySampleFoil = (current.aircraft.tailSurfaces ?? []).some((surface) => sampleTailIds.has(surface.id)
      && surface.sections.some((section) => PREVIOUS_TAIL_AIRFOIL_IDS.has(section.leftAirfoilId)
        || PREVIOUS_TAIL_AIRFOIL_IDS.has(section.rightAirfoilId)));
    const sampleElevator = sample.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-elevator");
    const previousSampleElevator = sampleElevator && {
      ...sampleElevator,
      rootPosition: { ...sampleElevator.rootPosition, x: 4.339 },
      sections: sampleElevator.sections.map((section) => ({ ...section, xOffset: 0 })),
    };
    const hasPreviousElevatorGeometry = Boolean(previousSampleElevator && current.aircraft.tailSurfaces?.some((surface) =>
      (surface.sparChordFraction === undefined || surface.sparChordFraction === previousSampleElevator.sparChordFraction)
      && sameWithoutSparPosition(surface, previousSampleElevator)));
    const sampleRudder = sample.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-rudder");
    const hasLegacyRudderPosition = Boolean(sampleRudder && current.aircraft.tailSurfaces?.some((surface) =>
      surface.id === sampleRudder.id && surface.rootPosition.x === 5.183
      && surface.sections.every((section, index) => {
        const original = sampleRudder.sections[index];
        return original && section.spanPosition === original.spanPosition
          && section.chord === original.chord && section.xOffset === original.xOffset;
      }) && surface.sections.length === sampleRudder.sections.length));
    const previousSampleRudder = sampleRudder && {
      ...sampleRudder,
      rootPosition: { ...sampleRudder.rootPosition, x: 5.255 },
      sections: sampleRudder.sections.map((section) => ({
        ...section, chord: section.spanPosition === 2.4 ? 0.76 : section.chord, xOffset: 0,
      })),
    };
    const hasPreviousRudderGeometry = Boolean(previousSampleRudder && current.aircraft.tailSurfaces?.some((surface) =>
      (surface.sparChordFraction === undefined || surface.sparChordFraction === previousSampleRudder.sparChordFraction)
      && sameWithoutSparPosition(surface, previousSampleRudder)));
    const correctedAircraft = {
      ...current.aircraft,
      sparChordFraction: canUpgradeWingSpar ? sample.aircraft.sparChordFraction : current.aircraft.sparChordFraction,
      tailSurfaces: current.aircraft.tailSurfaces?.map((surface) =>
        hasPreviousRudderGeometry && surface.id === sampleRudder?.id ? sampleRudder
          : hasPreviousElevatorGeometry && surface.id === sampleElevator?.id ? sampleElevator
            : tailSparUpgradeIds.has(surface.id) ? { ...surface, sparChordFraction: 0.25 } : surface),
    };
    const matchesSampleAircraft = JSON.stringify(correctedAircraft) === JSON.stringify(sample.aircraft);
    const sampleAircraftCase = sample.analysisCases.find((analysisCase) => analysisCase.id === "reference-hpa-whole-aircraft-tail-vlm");
    const matchesSampleCase = Boolean(sampleAircraftCase && current.analysisCases.some((analysisCase) =>
      JSON.stringify(analysisCase) === JSON.stringify(sampleAircraftCase)));
    const canRestoreSampleResult = (hasPreviousRudderGeometry || hasPreviousElevatorGeometry || sparPositionsChanged) && matchesSampleAircraft && matchesSampleCase;
    const sampleAircraftResult = sample.analysisResults.find((result) => result.caseId === sampleAircraftCase?.id);
    const tailGeometryChanged = hasLegacyRudderPosition || hasPreviousRudderGeometry || hasPreviousElevatorGeometry;
    const needsSampleUpgrade = (recovered.sampleTailRevision ?? 0) < SAMPLE_TAIL_REVISION && current.name === sample.name;
    if (needsSampleUpgrade || hasLegacySampleFoil || tailGeometryChanged || sparPositionsChanged) {
        const existing = current.aircraft.tailSurfaces ?? [];
        const ids = new Set(existing.map((surface) => surface.id));
        const additions = needsSampleUpgrade ? (sample.aircraft.tailSurfaces ?? []).filter((surface) => !ids.has(surface.id)) : [];
        const tailAirfoil = sample.airfoils.find((airfoil) => airfoil.name === "NACA0042");
        const updatedExisting = existing.map((surface) => sampleTailIds.has(surface.id) && tailAirfoil
          ? hasPreviousRudderGeometry && surface.id === sampleRudder?.id ? sampleRudder
            : hasPreviousElevatorGeometry && surface.id === sampleElevator?.id ? sampleElevator : { ...surface,
            sparChordFraction: tailSparUpgradeIds.has(surface.id) ? 0.25 : surface.sparChordFraction,
            rootPosition: hasLegacyRudderPosition && surface.id === sampleRudder?.id
              ? { ...surface.rootPosition, x: sampleRudder.rootPosition.x } : surface.rootPosition,
            sections: surface.sections.map((section) => ({
            ...section,
            leftAirfoilId: PREVIOUS_TAIL_AIRFOIL_IDS.has(section.leftAirfoilId) ? tailAirfoil.id : section.leftAirfoilId,
            rightAirfoilId: PREVIOUS_TAIL_AIRFOIL_IDS.has(section.rightAirfoilId) ? tailAirfoil.id : section.rightAirfoilId,
          })) }
          : surface);
        const foilAddition = tailAirfoil && !current.airfoils.some((airfoil) => airfoil.id === tailAirfoil.id) ? [tailAirfoil] : [];
        const polarIds = new Set(current.polars.map((polar) => polar.id));
        const polarAdditions = sample.polars.filter((polar) => polar.airfoilId === tailAirfoil?.id && !polarIds.has(polar.id));
        const runIds = new Set(current.airfoilAnalysisRuns.map((run) => run.id));
        const runAdditions = sample.airfoilAnalysisRuns.filter((run) => run.airfoilIds.includes(tailAirfoil?.id ?? "") && !runIds.has(run.id));
        const updated = {
          ...current,
          airfoils: [...current.airfoils, ...foilAddition],
          polars: [...current.polars, ...polarAdditions],
          airfoilAnalysisRuns: [...current.airfoilAnalysisRuns, ...runAdditions],
          aircraft: { ...current.aircraft, sparChordFraction: canUpgradeWingSpar ? sample.aircraft.sparChordFraction : current.aircraft.sparChordFraction, tailSurfaces: [...additions, ...updatedExisting] },
          analysisCases: tailGeometryChanged ? current.analysisCases.map((analysisCase) =>
            analysisCase.scope === "aircraft" && !(canRestoreSampleResult && analysisCase.id === sampleAircraftCase?.id)
              ? { ...analysisCase, status: "needs-review" as const } : analysisCase) : current.analysisCases,
          analysisResults: tailGeometryChanged || canRestoreSampleResult ? current.analysisResults.map((result) =>
            canRestoreSampleResult && result.caseId === sampleAircraftCase?.id && sampleAircraftResult ? sampleAircraftResult
              : result.caseSnapshot?.scope === "aircraft" ? { ...result, status: "needs-review" as const,
                rows: result.rows.map((row) => ({ ...row, status: "needs-review" as const })) } : result) : current.analysisResults,
        };
        if (!validateDesignDocument(updated).valid) return { document: current, isDirty: recovered.isDirty };
        const changed = sparPositionsChanged || tailGeometryChanged || additions.length > 0 || foilAddition.length > 0 || polarAdditions.length > 0 || runAdditions.length > 0 || updatedExisting.some((surface, index) =>
          surface.rootPosition.x !== existing[index].rootPosition.x
          || surface.sections.some((section, sectionIndex) => section.leftAirfoilId !== existing[index].sections[sectionIndex].leftAirfoilId
            || section.rightAirfoilId !== existing[index].sections[sectionIndex].rightAirfoilId));
        const next = { document: updated, isDirty: recovered.isDirty || changed, sampleTailRevision: SAMPLE_TAIL_REVISION };
        try {
          storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify(next));
        } catch {
          // Keep the prior recovery intact if browser storage is full.
        }
        return { document: updated, isDirty: next.isDirty };
    }
    return { document: current, isDirty: recovered.isDirty };
  } catch {
    return discardRecovery(storage);
  }
}

function toRecoveredDocument(value: unknown): (RecoveredDesignDocument & { sampleTailRevision?: number }) | null {
  if (!isRecord(value) || !("document" in value)) {
    return value ? { document: value as DesignDocument, isDirty: true } : null;
  }
  return typeof value.isDirty === "boolean" ? { document: value.document as DesignDocument, isDirty: value.isDirty, sampleTailRevision: typeof value.sampleTailRevision === "number" ? value.sampleTailRevision : undefined } : null;
}

function discardRecovery(storage: Storage) {
  try {
    storage.removeItem(WORKING_DOCUMENT_ID);
  } catch {
    // The application can continue with the initial document when browser storage is unavailable.
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameWithoutSparPosition(left: TailSurface, right: TailSurface) {
  return JSON.stringify({ ...left, sparChordFraction: undefined })
    === JSON.stringify({ ...right, sparChordFraction: undefined });
}
