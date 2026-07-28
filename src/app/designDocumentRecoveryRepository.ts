import type { EntityRepository } from "../shared/model";
import type { DesignDocument } from "./designDocument";
import { migrateDesignDocument, validateDesignDocument } from "./designDocumentTransfer";

export const WORKING_DOCUMENT_ID = "hpa-design:working-document";

export interface RecoveredDesignDocument {
  document: DesignDocument;
  isDirty: boolean;
}

export type DesignDocumentRecoveryRepository = EntityRepository<DesignDocument, string> & {
  saveRecovery: (document: DesignDocument, state: Pick<RecoveredDesignDocument, "isDirty">) => Promise<DesignDocument>;
};

export function createDesignDocumentRecoveryRepository(storage: Storage): DesignDocumentRecoveryRepository {
  const saveRecovery = async (document: DesignDocument, state: Pick<RecoveredDesignDocument, "isDirty">) => {
    storage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({ document, isDirty: state.isDirty }));
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
    return validateDesignDocument(document).valid ? { ...recovered, document: document as DesignDocument } : discardRecovery(storage);
  } catch {
    return discardRecovery(storage);
  }
}

function toRecoveredDocument(value: unknown): RecoveredDesignDocument | null {
  if (!isRecord(value) || !("document" in value)) {
    return value ? { document: value as DesignDocument, isDirty: true } : null;
  }
  return typeof value.isDirty === "boolean" ? { document: value.document as DesignDocument, isDirty: value.isDirty } : null;
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
