import { describe, expect, it } from "vitest";
import {
  airfoilDatImporter,
  createAirfoilFromDat,
  createNaca4Airfoil,
  isNaca4Code,
  parseAirfoilDat,
  validateAirfoilDat,
} from "./airfoilGeometry";

const seligDat = `Example Selig airfoil
# Comments may appear between coordinate rows
1.0D+00 0.000
0.5 0.080
0.0 0.000
0.5 -0.060
1.0 0.000`;

const lednicerDat = `Example Lednicer airfoil
3 3
0.0 0.000
0.5 0.080
1.0 0.000
0.0 0.000
0.5 -0.060
1.0 0.000`;

describe("parseAirfoilDat", () => {
  it("parses a Selig .dat file, including comments and Fortran exponents", () => {
    const parsed = parseAirfoilDat(seligDat);

    expect(parsed.name).toBe("Example Selig airfoil");
    expect(parsed.format).toBe("selig");
    expect(parsed.coordinates).toEqual([
      { x: 0, upper: 0, lower: 0 },
      { x: 0.5, upper: 0.08, lower: -0.06 },
      { x: 1, upper: 0, lower: 0 },
    ]);
    expect(validateAirfoilDat(parsed)).toEqual({ valid: true, issues: [] });
  });

  it("parses a Lednicer .dat file using its declared upper and lower counts", async () => {
    const parsed = await airfoilDatImporter.parse(lednicerDat);

    expect(parsed.name).toBe("Example Lednicer airfoil");
    expect(parsed.format).toBe("lednicer");
    expect(parsed.coordinates[1]).toEqual({ x: 0.5, upper: 0.08, lower: -0.06 });
    await expect(airfoilDatImporter.validate(parsed)).resolves.toEqual({ valid: true, issues: [] });
  });

  it("rejects Lednicer data whose point count does not match the header", () => {
    expect(() => parseAirfoilDat(`Broken\n3 3\n0 0\n0.5 0.1\n1 0\n0 0\n1 0`)).toThrow();
  });

  it("warns when source coordinates need chord normalization", () => {
    const parsed = parseAirfoilDat(`Scaled\n2 0\n1 0.1\n0 0\n1 -0.1\n2 0`);

    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0].severity).toBe("warning");
    expect(parsed.coordinates.map((point) => point.x)).toEqual([0, 0.5, 1]);
  });
});

describe("airfoil creation", () => {
  it("derives a persisted airfoil and its geometric metrics from imported data", () => {
    const airfoil = createAirfoilFromDat(parseAirfoilDat(seligDat), "airfoil-1", "  Custom name  ");

    expect(airfoil).toMatchObject({
      id: "airfoil-1",
      name: "Custom name",
      thicknessRatio: 14,
      maxCamber: 1,
      trailingEdgeThickness: 0,
    });
  });

  it("generates a NACA 2412 with the specified standard metrics", () => {
    const airfoil = createNaca4Airfoil("2412", "naca-2412");

    expect(airfoil).toMatchObject({
      id: "naca-2412",
      name: "NACA2412",
      thicknessRatio: 12,
      maxCamber: 2,
      leadingEdgeRadius: 1.587,
      trailingEdgeThickness: 0,
    });
    expect(airfoil.coordinates[0].x).toBe(0);
    expect(airfoil.coordinates.at(-1)?.x).toBe(1);
    expect(airfoil.coordinates).toHaveLength(160);
  });

  it("generates a symmetric NACA 0012", () => {
    const airfoil = createNaca4Airfoil("0012", "naca-0012", 11);

    expect(airfoil.coordinates).toHaveLength(11);
    for (const point of airfoil.coordinates) {
      expect(point.upper).toBeCloseTo(-point.lower, 12);
    }
  });

  it("validates NACA 4-digit input and rejects unsupported parameter combinations", () => {
    expect(isNaca4Code("2412")).toBe(true);
    expect(isNaca4Code("NACA2412")).toBe(false);
    expect(() => createNaca4Airfoil("1000", "invalid")).toThrow();
    expect(() => createNaca4Airfoil("0012", "too-few-points", 2)).toThrow();
  });
});
