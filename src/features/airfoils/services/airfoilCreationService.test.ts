import { describe, expect, it } from "vitest";
import {
  createDatAirfoilPreview,
  createNacaAirfoilPreview,
  readAirfoilDatFile,
} from "./airfoilCreationService";

const validDat = `Suggested name
1 0
0.5 0.08
0 0
0.5 -0.06
1 0`;

describe("airfoilCreationService", () => {
  it("returns a ready-to-save preview for valid DAT input", () => {
    const preview = createDatAirfoilPreview({ datText: validDat, id: "import-1", name: "" });

    expect(preview.valid).toBe(true);
    if (preview.valid) {
      expect(preview.suggestedName).toBe("Suggested name");
      expect(preview.airfoil).toMatchObject({ id: "import-1", name: "Suggested name" });
      expect(preview.format).toBe("selig");
    }
  });

  it("returns an invalid preview rather than throwing for malformed DAT input", () => {
    const preview = createDatAirfoilPreview({ datText: "No coordinates", id: "bad-import", name: "" });

    expect(preview.valid).toBe(false);
    if (!preview.valid) {
      expect(preview.error).not.toBe("");
      expect(preview.issues).toEqual([]);
    }
  });

  it("returns an invalid NACA preview rather than throwing", () => {
    const preview = createNacaAirfoilPreview("NACA2412", "bad-naca");

    expect(preview.valid).toBe(false);
  });

  it("reads the selected DAT file content", async () => {
    const file = { text: async () => validDat } as File;

    await expect(readAirfoilDatFile(file)).resolves.toBe(validDat);
  });
});
