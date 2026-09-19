import referenceProject from "../../examples/Anonymized-HPA-Reference.json";
import { createDefaultConceptualDesign } from "../features/conceptual-design/model/conceptualDesign";
import type { DesignDocument } from "./designDocument";
import { parseDesignDocument } from "./designDocumentTransfer";

export function createDefaultDesignDocument(): DesignDocument {
  return {
    ...parseDesignDocument(JSON.stringify(referenceProject)),
    conceptualDesign: { ...createDefaultConceptualDesign(), cruiseSpeed: 7.4 },
  };
}
