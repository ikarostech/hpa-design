import { describe, expect, it } from "vitest";
import referenceProject from "../../examples/Anonymized-HPA-Reference.json";
import { parseDesignDocument, validateDesignDocument } from "./designDocumentTransfer";
import { deriveTailGeometry } from "../features/aircraft/model/tailGeometry";
import { deriveWingGeometry } from "../features/aircraft/model/wingGeometry";
import { analyzeTailSurface } from "../features/analysis/services/tailAnalysisService";
import { createDefaultDesignDocument } from "./defaultDesignDocument";

describe("createDefaultDesignDocument", () => {
  it("includes the real cruise speed in the importable reference project", () => {
    expect(parseDesignDocument(JSON.stringify(referenceProject)).conceptualDesign?.cruiseSpeed).toBe(7.4);
  });

  it("includes the elevator and rudder rib geometry from the design workbook for standalone analysis", () => {
    const document = createDefaultDesignDocument();
    const [elevator, rudder] = document.aircraft.tailSurfaces ?? [];

    expect(document.aircraft.tailSurfaces).toHaveLength(2);
    expect(document.aircraft.sparChordFraction).toBe(0.35);
    expect(elevator.name).toBe("エレベーター");
    expect(elevator.sparChordFraction).toBe(0.25);
    expect(elevator.orientation).toBe("horizontal");
    expect(elevator.sections.map(({ spanPosition, chord }) => [spanPosition, chord])).toEqual([
      [0, 0.84], [0.3, 0.84], [0.6, 0.84], [0.9, 0.72], [1.2, 0.6], [1.5, 0.48],
    ]);
    expect(deriveTailGeometry(elevator).area).toBeCloseTo(2.196);
    const elevatorQuarterChordOffsets = elevator.sections.map(({ xOffset, chord }) => xOffset + chord / 4);
    for (const offset of elevatorQuarterChordOffsets) expect(offset).toBeCloseTo(elevatorQuarterChordOffsets[0], 8);
    expect(elevator.sections.at(-1)?.xOffset).toBeGreaterThan(0);
    expect(deriveTailGeometry(elevator).aerodynamicCenter.x - deriveWingGeometry(document.aircraft.sections).quarterMacX).toBeCloseTo(4.3, 2);

    expect(rudder.name).toBe("ラダー");
    expect(rudder.sparChordFraction).toBe(0.25);
    expect(rudder.orientation).toBe("vertical");
    expect(rudder.rootPosition.z).toBeCloseTo(-0.6);
    expect(rudder.sections.map(({ spanPosition, chord }) => [spanPosition, chord])).toEqual([
      [0, 0.68], [0.3, 0.76], [0.6, 0.84], [0.9, 0.84], [1.2, 0.84],
      [1.5, 0.795], [1.8, 0.75], [2.1, 0.705], [2.4, 0.66], [2.7, 0.615],
    ]);
    expect(deriveTailGeometry(rudder).area).toBeCloseTo(2.05125);
    const quarterChordOffsets = rudder.sections.map(({ xOffset, chord }) => xOffset + chord / 4);
    for (const offset of quarterChordOffsets) expect(offset).toBeCloseTo(quarterChordOffsets[0], 8);
    expect(rudder.sections[2].xOffset).toBeLessThan(0);
    expect(rudder.sections.at(-1)?.xOffset).toBeGreaterThan(0);
    expect(deriveTailGeometry(rudder).aerodynamicCenter.x - deriveWingGeometry(document.aircraft.sections).quarterMacX).toBeCloseTo(5.15, 2);

    const tailAirfoil = document.airfoils.find((airfoil) => airfoil.name === "NACA0042");
    expect(tailAirfoil).toMatchObject({ thicknessRatio: 42, maxCamber: 0, trailingEdgeThickness: 0 });
    expect(tailAirfoil?.coordinates.length).toBeGreaterThan(40);
    for (const point of tailAirfoil?.coordinates ?? []) {
      expect(point.upper).toBeCloseTo(-point.lower, 10);
    }
    for (const surface of [elevator, rudder]) {
      expect(surface.sections.every((section) => section.leftAirfoilId === tailAirfoil?.id && section.rightAirfoilId === tailAirfoil?.id)).toBe(true);
    }

    const tailPolars = document.polars.filter((polar) => polar.airfoilId === tailAirfoil?.id);
    expect(document.airfoils.some((airfoil) => airfoil.name === "NACA0012")).toBe(false);
    expect(tailPolars.map((polar) => polar.reynolds)).toEqual([200000, 300000, 450000, 600000]);
    expect(tailPolars.every((polar) => polar.status === "complete" && polar.points.length === 13)).toBe(true);
    for (const surface of [elevator, rudder]) {
      for (const speed of [7.4, 10]) {
        const result = analyzeTailSurface(surface, { speed, density: 1.225, dynamicViscosity: 0.0000181, alpha: 2, beta: 2 }, document.polars);
        expect(result.status, `${surface.name} at ${speed} m/s`).toBe("valid");
        if (result.status === "valid") {
          expect(result.profileCd).toBeGreaterThan(0);
          expect(result.drag).toBeGreaterThan(result.inducedDrag);
          expect(result.polarIds.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("loads a completed whole-aircraft analysis with both tail surfaces", () => {
    const document = createDefaultDesignDocument();
    const analysisCase = document.analysisCases.find((item) => item.scope === "aircraft");
    const result = document.analysisResults.find((item) => item.caseId === analysisCase?.id);
    const tailIds = document.aircraft.tailSurfaces?.map((surface) => surface.id) ?? [];
    const tailAirfoil = document.airfoils.find((airfoil) => airfoil.name === "NACA0042");

    expect(analysisCase).toMatchObject({ method: "VLM", status: "completed", speed: 7.4 });
    expect(result).toMatchObject({ status: "completed", caseSnapshot: analysisCase });
    expect(result?.airfoilIds).toContain(tailAirfoil?.id);
    expect(result?.aircraftSnapshot?.tailSurfaces).toHaveLength(2);
    expect(result?.aircraftSnapshot?.sparChordFraction).toBe(document.aircraft.sparChordFraction);
    expect(result?.aircraftSnapshot?.tailSurfaces?.find((surface) => surface.id === "reference-hpa-elevator")).toEqual(document.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-elevator"));
    expect(result?.aircraftSnapshot?.tailSurfaces?.find((surface) => surface.id === "reference-hpa-rudder")).toEqual(document.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-rudder"));
    expect(result?.rows.length).toBeGreaterThan(0);
    for (const row of result?.rows ?? []) {
      expect(row.status).toBe("completed");
      expect(tailIds.every((id) => row.surfaceLoads?.some((load) => load.surfaceId === id))).toBe(true);
    }
  });

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
