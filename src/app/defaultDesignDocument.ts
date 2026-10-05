import referenceProject from "../../examples/Anonymized-HPA-Reference.json";
import type { DesignDocument } from "./designDocument";
import { parseDesignDocument } from "./designDocumentTransfer";

export function createDefaultDesignDocument(): DesignDocument {
  return parseDesignDocument(JSON.stringify(referenceProject));
}
