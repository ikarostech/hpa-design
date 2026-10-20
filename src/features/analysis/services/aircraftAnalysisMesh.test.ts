import { describe, expect, it } from "vitest";
import type { AircraftGeometry, TailSurface } from "../../aircraft/model/types";
import { createAircraftAnalysisMesh, createTailAnalysisMesh } from "./aircraftAnalysisMesh";
import { calculateAircraftVlmCoefficients } from "./vlmSolver";

const tail: TailSurface = {
  id: "tail", name: "Tail", orientation: "horizontal", rootPosition: { x: 4, y: 0, z: 1 },
  incidence: 0, symmetric: false, isDoubleFin: false, isSymmetricFin: false,
  sections: [0, 2].map((spanPosition, index) => ({
    id: `section-${index}`, spanPosition, chord: 1, xOffset: 0, dihedral: 0, twist: 0,
    leftAirfoilId: "left", rightAirfoilId: "right", chordwisePanels: 2, spanwisePanels: 4,
    chordwiseDistribution: "uniform", spanwiseDistribution: "uniform",
  })),
};
const aircraft: AircraftGeometry = {
  id: "aircraft", span: 8, wingArea: 8, mac: 1, rootChord: 1, tipChord: 1,
  aspectRatio: 8, taperRatio: 1, twist: 0, dihedral: 0, sweep: 0, incidence: 0, staticMargin: 0,
  sections: [0, 4].map((yPosition, index) => ({
    id: `wing-${index}`, yPosition, chord: 1, xOffset: 0, dihedral: 0, twist: 0,
    airfoilId: "wing-foil", chordwisePanels: 2, spanwisePanels: 4,
    chordwiseDistribution: "uniform", spanwiseDistribution: "uniform",
  })), tailSurfaces: [tail],
};

describe("aircraft analysis mesh", () => {
  it.each(["horizontal", "vertical"] as const)("rotates an all-moving %s tail about its fixed spar axis", (orientation) => {
    const surface = { ...tail, orientation, rootPosition: { x: 4, y: 2, z: 1 }, sparChordFraction: 0.5, incidence: 12 };
    const mesh = createTailAnalysisMesh(surface);
    const sparNodes = mesh.nodes.filter((node) => node.chordFraction === 0.5);
    expect(sparNodes.length).toBeGreaterThan(0);
    expect(sparNodes.every((node) => Math.abs(node.x - 4.5) < 1e-10)).toBe(true);
    expect(sparNodes.every((node) => Math.abs((orientation === "horizontal" ? node.z - 1 : node.y - 2)) < 1e-10)).toBe(true);
  });
  it("places both tail halves in aircraft axes and retains their foil references", () => {
    const mesh = createTailAnalysisMesh(tail);
    expect(mesh.panels).toHaveLength(16);
    expect(Math.min(...mesh.nodes.map((node) => node.x))).toBe(4);
    expect(Math.max(...mesh.nodes.map((node) => node.x))).toBe(5);
    expect(Math.min(...mesh.nodes.map((node) => node.y))).toBe(-2);
    expect(Math.max(...mesh.nodes.map((node) => node.y))).toBe(2);
    expect(mesh.nodes.every((node) => node.z === 1)).toBe(true);
    expect(mesh.panels.every((panel) => panel.surfaceId === "tail")).toBe(true);
    expect(mesh.panels.filter((panel) => panel.side === "left").every((panel) => panel.airfoilRootId === "left")).toBe(true);
    expect(createTailAnalysisMesh({ ...tail, symmetric: true }).panels.every((panel) => panel.airfoilRootId === "right")).toBe(true);
  });

  it("projects span length with dihedral and rotates incidence about the root spar", () => {
    const mesh = createTailAnalysisMesh({ ...tail, incidence: 10, sections: tail.sections.map((section) => ({ ...section, dihedral: 30 })) });
    const tip = mesh.nodes.find((node) => node.side === "right" && node.chordFraction === 0 && Math.abs(node.y - Math.sqrt(3)) < 1e-8)!;
    expect(tip.x).toBeCloseTo(4 + 0.25 * (1 - Math.cos(Math.PI / 18)) + Math.sin(Math.PI / 18), 8);
    expect(tip.z).toBeCloseTo(1 + 0.25 * Math.sin(Math.PI / 18) + Math.cos(Math.PI / 18), 8);
  });

  it("creates a single upright fin and rejects removed fin arrangements", () => {
    const fin = { ...tail, orientation: "vertical" as const, rootPosition: { x: 4, y: 2, z: 1 } };
    const single = createTailAnalysisMesh(fin);
    expect(single.panels).toHaveLength(8);
    expect(single.nodes.every((node) => node.y === 2)).toBe(true);
    expect(Math.max(...single.nodes.map((node) => node.z))).toBe(3);
    expect(() => createTailAnalysisMesh({ ...fin, isDoubleFin: true })).toThrow(/Double Fin.*対応/);
    expect(() => createTailAnalysisMesh({ ...fin, isDoubleFin: true, isSymmetricFin: true })).toThrow(/Symmetric Fin.*対応/);
  });

  it("combines surfaces without losing identity or applying wing incidence to the tail", () => {
    const mesh = createAircraftAnalysisMesh({ ...aircraft, incidence: 5 });
    expect(mesh.panels).toHaveLength(32);
    expect(new Set(mesh.panels.map((panel) => panel.surfaceId))).toEqual(new Set(["aircraft", "tail"]));
    expect(mesh.panels.filter((panel) => panel.surfaceId === "tail").every((panel) => panel.corners.every((node) => node.z === 1))).toBe(true);
    expect(mesh.panels.filter((panel) => panel.surfaceId === "aircraft").some((panel) => panel.corners.some((node) => node.z < 0))).toBe(true);
  });

  it("rejects malformed tail geometry instead of emitting degenerate panels", () => {
    expect(() => createTailAnalysisMesh({ ...tail, sections: tail.sections.slice(0, 1) })).toThrow(/two tail sections/i);
    expect(() => createTailAnalysisMesh({ ...tail, sections: tail.sections.map((section) => ({ ...section, chord: 0 })) })).toThrow(/positive/i);
  });

  it("twists the chord in the local dihedral plane while preserving its quarter chord", () => {
    const twisted = { ...tail, sections: tail.sections.map((section) => ({ ...section, twist: 20, dihedral: 30, chordwisePanels: 4 })) };
    const mesh = createTailAnalysisMesh(twisted);
    const quarter = mesh.nodes.find((node) => node.side === "right" && node.chordFraction === 0.25)!;
    const leading = mesh.nodes.find((node) => node.side === "right" && node.chordFraction === 0)!;
    expect(quarter).toMatchObject({ x: 4.25, y: 0, z: 1 });
    expect(leading.y).toBeCloseTo(-0.25 * Math.sin(Math.PI / 9) * Math.sin(Math.PI / 6), 8);
    expect(leading.z - quarter.z).toBeCloseTo(0.25 * Math.sin(Math.PI / 9) * Math.cos(Math.PI / 6), 8);
  });
});

describe("all-surface VLM", () => {
  const reference = { area: 8, span: 8, chord: 1, point: { x: 0.25, y: 0, z: 0 } };
  it("solves mutual induction rather than adding independent wing and tail loads", () => {
    const coplanarTail = { ...tail, rootPosition: { x: 4, y: 0, z: 0 } };
    const coupled = calculateAircraftVlmCoefficients(createAircraftAnalysisMesh({ ...aircraft, tailSurfaces: [coplanarTail] }), { alpha: 5, beta: 0, reference });
    const isolated = calculateAircraftVlmCoefficients(createTailAnalysisMesh(coplanarTail), { alpha: 5, beta: 0, reference });
    const tailLift = coupled.panelLoads.filter((load) => load.surfaceId === "tail").reduce((sum, load) => sum + load.force.z, 0);
    expect(tailLift).toBeGreaterThan(0);
    expect(tailLift).toBeLessThan(isolated.force.z * 0.9);
    expect(coupled.panelLoads.reduce((sum, load) => sum + load.force.z, 0)).toBeCloseTo(coupled.force.z, 10);
    expect(coupled.cdi).toBeGreaterThan(0);
  });

  it("produces odd fin side force and yaw moment under opposite sideslip", () => {
    const mesh = createTailAnalysisMesh({ ...tail, orientation: "vertical", rootPosition: { x: 4, y: 0, z: 0 } });
    const solve = (beta: number) => calculateAircraftVlmCoefficients(mesh, { alpha: 0, beta, reference });
    const positive = solve(5);
    const negative = solve(-5);
    expect(Math.abs(positive.cy)).toBeGreaterThan(0.01);
    expect(positive.cy).toBeCloseTo(-negative.cy, 10);
    expect(positive.cn).toBeCloseTo(-negative.cn, 10);
    expect(positive.cl).toBeCloseTo(0, 10);
    expect(solve(0).cy).toBeCloseTo(0, 10);
  });

  it("uses explicit moment reference and coefficient dimensions", () => {
    const mesh = createTailAnalysisMesh(tail);
    const result = calculateAircraftVlmCoefficients(mesh, { alpha: 5, beta: 0, reference });
    const shifted = calculateAircraftVlmCoefficients(mesh, { alpha: 5, beta: 0, reference: { ...reference, point: { x: 1.25, y: 0, z: 0 } } });
    expect(shifted.cl).toBeCloseTo(result.cl, 10);
    expect(shifted.cm - result.cm).toBeCloseTo(result.force.z / reference.area / reference.chord, 10);
    const scaled = calculateAircraftVlmCoefficients(mesh, { alpha: 5, beta: 0, reference: { ...reference, area: 16 } });
    expect(scaled.cl).toBeCloseTo(result.cl / 2, 10);
    expect(scaled.cm).toBeCloseTo(result.cm / 2, 10);
    expect(() => calculateAircraftVlmCoefficients(mesh, { alpha: 5, beta: 0, reference: { ...reference, area: 0 } })).toThrow(/reference/i);
  });
});
