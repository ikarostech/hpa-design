import { describe, expect, it } from "vitest";
import { validateDesignDocument } from "./designDocumentTransfer";
import { createDefaultDesignDocument } from "./defaultDesignDocument";

describe("createDefaultDesignDocument", () => {
  it("provides an importable sample covering aerodynamic, structural, and integrated spanwise results", () => {
    const document = createDefaultDesignDocument();
    const aerodynamicResult = document.analysisResults.find((result) => result.status === "completed" && result.rows.some((row) => row.spanwise));
    const structuralResult = document.structuralResults.find((result) =>
      result.status === "completed"
      && result.loadCaseSnapshot.aerodynamicResultId === aerodynamicResult?.id
      && result.loadCaseSnapshot.aerodynamicAlphaDegrees !== undefined,
    );

    expect(document.conceptualDesign).toEqual({
      grossMass: 100,
      cruiseSpeed: 8,
      maximumWingspan: 30,
      groundHeight: 1,
      sustainablePower: 250,
    });
    expect(validateDesignDocument(document)).toEqual({ valid: true });
    expect(aerodynamicResult?.rows.some((row) => row.spanwise?.samples.length)).toBe(true);
    expect(structuralResult?.loadCaseSnapshot.aerodynamicAlphaDegrees).toBe(
      aerodynamicResult?.rows.reduce((maximum, row) => row.cl > maximum.cl ? row : maximum).alpha,
    );
    expect(structuralResult?.points.some((point) =>
      point.bendingMomentCapacity !== undefined
      && point.torqueCapacity !== undefined
      && point.minReserveFactor > 0,
    )).toBe(true);
    expect(structuralResult?.summary.governingMode).toBe("Excel準拠曲げ");
  });

  it("returns a fresh document so edits cannot mutate the next default project", () => {
    const first = createDefaultDesignDocument();
    (first.analysisResults[0].rows[0].spanwise!.samples[0].values as { liftPerLength: number }).liftPerLength = 999;

    expect(createDefaultDesignDocument().analysisResults[0].rows[0].spanwise!.samples[0].values.liftPerLength).not.toBe(999);
  });
});
