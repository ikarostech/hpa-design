import type { Exporter, Importer, ValidationResult } from "../shared/model/transfer";
import type { DesignDocument } from "./designDocument";

export const designDocumentImporter: Importer<string, DesignDocument> = {
  parse: async (input) => JSON.parse(input) as DesignDocument,
  validate: (document) => validateDesignDocument(document),
};

export const designDocumentExporter: Exporter<DesignDocument, string> = {
  export: async (document) => JSON.stringify(document, null, 2),
};

function validateDesignDocument(document: DesignDocument): ValidationResult {
  if (document.schemaVersion !== 1) {
    return {
      valid: false,
      issues: [{ path: ["schemaVersion"], message: "対応していない設計ファイルです。", severity: "error" }],
    };
  }

  if (typeof document.name !== "string" || !document.aircraft || !Array.isArray(document.airfoils)) {
    return {
      valid: false,
      issues: [{ message: "設計ファイルの内容が不足しています。", severity: "error" }],
    };
  }

  return { valid: true };
}
