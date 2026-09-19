import { describe, expect, it } from "vitest";
import { validateDesignDocument } from "./designDocumentTransfer";
import { createDefaultDesignDocument } from "./defaultDesignDocument";

describe("createDefaultDesignDocument", () => {
  it("provides the anonymized HPA reference project with its saved analysis results", () => {
    const document = createDefaultDesignDocument();
    const aerodynamicResult = document.analysisResults.find((result) => result.status === "completed" && result.rows.some((row) => row.spanwise));
    const structuralResult = document.structuralResults.find((result) => result.status === "completed");

    expect(document.name).toBe("匿名化 HPA 参照設計（保存済み解析結果）");
    expect(document.analysisCases[0]).toMatchObject({ id: "reference-hpa-flight-design-point", speed: 7.4 });
    expect(document.conceptualDesign).toEqual({
      grossMass: 100,
      cruiseSpeed: 7.4,
      maximumWingspan: 30,
      groundHeight: 1,
      sustainablePower: 250,
    });
    expect(validateDesignDocument(document)).toEqual({ valid: true });
    expect(aerodynamicResult?.rows.some((row) => row.spanwise?.samples.length)).toBe(true);
    expect(aerodynamicResult?.rows.some((row) => row.alpha === 5)).toBe(true);
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

  it("loads the completed 7.4 m/s, 5 degree coupled analysis with its applicability warning", () => {
    const result = createDefaultDesignDocument().aeroelasticResults?.[0];

    expect(result).toMatchObject({
      id: "reference-hpa-coupled-7p4ms-5deg",
      status: "converged",
      reviewStatus: "current",
      speed: 7.4,
      condition: { mode: "fixed-alpha", alphaDegrees: 5 },
      structuralDesignId: "reference-hpa-main-spar",
    });
    expect(result?.iterations.length).toBe(37);
    expect(result?.totalLift).toBeCloseTo(926.35, 1);
    expect(result?.structuralResult.summary.maxDeflection).toBeCloseTo(2.485, 2);
    expect(result?.structuralResult.points.at(-1)?.localBucklingReserveFactor).toBe(Number.POSITIVE_INFINITY);
    expect(result?.structuralResult.points.at(-1)?.brazierReserveFactor).toBe(Number.POSITIVE_INFINITY);
    expect(result?.warnings.some((warning) => warning.includes("10%"))).toBe(true);
  });
});
