import { describe, expect, it } from "vitest";
import { designDocumentExporter, designDocumentImporter } from "./designDocumentTransfer";

const document = {
  schemaVersion: 1 as const,
  name: "Imported Glider",
  airfoils: [],
  polars: [],
  airfoilAnalysisRuns: [],
  aircraft: { id: "geo-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.333, mac: 0.78, staticMargin: 8, sections: [] },
  analysisCases: [],
  analysisResults: [],
};

describe("design document transfer", () => {
  it("round-trips an exported design file", async () => {
    const text = await designDocumentExporter.export(document);
    const imported = await designDocumentImporter.parse(text);

    expect(await designDocumentImporter.validate(imported)).toEqual({ valid: true });
    expect(imported).toMatchObject({ name: "Imported Glider", aircraft: { id: "geo-1" } });
  });

  it("rejects a file without the design document schema", async () => {
    const imported = await designDocumentImporter.parse('{"name":"Missing schema"}');

    expect(await designDocumentImporter.validate(imported)).toEqual({
      valid: false,
      issues: [{ path: ["schemaVersion"], message: "対応していない設計ファイルです。", severity: "error" }],
    });
  });
});
