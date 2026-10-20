import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../model/types";
import { TailPreview } from "./TailPreview";
import { createAircraftAnalysisMesh } from "../model/aircraftMesh";

const panelDefaults = {
  chordwisePanels: 8,
  spanwisePanels: 6,
  chordwiseDistribution: "cosine" as const,
  spanwiseDistribution: "uniform" as const,
};

const aircraft: AircraftGeometry = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5,
  twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3,
  aspectRatio: 5.33, mac: 0.78, staticMargin: 8,
  sections: [
    { ...panelDefaults, id: "wing-root", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af-1" },
    { ...panelDefaults, id: "wing-tip", yPosition: 2, chord: 0.5, xOffset: 0.3, twist: 0, dihedral: 0, airfoilId: "af-1" },
  ],
  tailSurfaces: [{
    id: "tail-1", name: "水平尾翼", orientation: "horizontal",
    rootPosition: { x: 4, y: 0, z: 0.2 }, incidence: 0,
    symmetric: true, isDoubleFin: false, isSymmetricFin: false,
    sections: [
      { ...panelDefaults, id: "tail-root", spanPosition: 0, chord: 0.8, xOffset: 0, dihedral: 0, twist: 0, leftAirfoilId: "af-1", rightAirfoilId: "af-1" },
      { ...panelDefaults, id: "tail-tip", spanPosition: 1.5, chord: 0.4, xOffset: 0.2, dihedral: 0, twist: 0, leftAirfoilId: "af-1", rightAirfoilId: "af-1" },
    ],
  }],
};

afterEach(cleanup);

describe("TailPreview", () => {
  it.each(["horizontal", "vertical"] as const)("projects the actual %s tail geometry in both views", (orientation) => {
    const changed: AircraftGeometry = { ...aircraft, incidence: 4, tailSurfaces: aircraft.tailSurfaces!.map((surface) => ({
      ...surface, orientation, rootPosition: { x: 4, y: 0.7, z: -0.4 }, incidence: 12,
      sections: surface.sections.map((section) => ({ ...section, twist: 8, dihedral: 20 })),
    })) };
    const mesh = createAircraftAnalysisMesh(changed);
    render(<TailPreview aircraft={changed} />);
    for (const view of ["top", "side"] as const) {
      const polygon = screen.getAllByTestId(`tail-${view}-planform`)[0];
      const svg = polygon.closest("svg")!;
      const scale = Number(svg.getAttribute(`data-${view}-scale`));
      const offsetX = Number(svg.getAttribute(`data-${view}-offset-x`));
      const offsetY = Number(svg.getAttribute(`data-${view}-offset-y`));
      const points = parsePolygon(polygon.getAttribute("points")!);
      expect(screen.getAllByTestId(`tail-${view}-planform`)).toHaveLength(orientation === "horizontal" ? 2 : 1);
      const leading = mesh.nodes.find((point) => point.side === "right" && point.chordFraction === 0 && point.x > 3)!;
      expect(points[0].x).toBeCloseTo(offsetX + (view === "top" ? leading.y : leading.x) * scale, 8);
      expect(points[0].y).toBeCloseTo(offsetY + (view === "top" ? leading.x : -leading.z) * scale, 8);
      for (const point of points) {
        expect(mesh.nodes.some((node) => node.side === "right" && node.x > 3
          && Math.abs(point.x - offsetX - (view === "top" ? node.y : node.x) * scale) < 1e-8
          && Math.abs(point.y - offsetY - (view === "top" ? node.x : -node.z) * scale) < 1e-8)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(20);
        expect(point.x).toBeLessThanOrEqual(740);
        expect(point.y).toBeGreaterThanOrEqual(view === "top" ? 35 : 255);
        expect(point.y).toBeLessThanOrEqual(view === "top" ? 200 : 395);
      }
    }
  });
  it("shows a spar line at the configured tail chord fraction", () => {
    const { container, rerender } = render(<TailPreview aircraft={aircraft} />);
    const first = container.querySelector('[data-testid="tail-spar"]')?.getAttribute("d");
    expect(first).toBeTruthy();
    rerender(<TailPreview aircraft={{ ...aircraft, tailSurfaces: aircraft.tailSurfaces?.map((surface) => ({ ...surface, sparChordFraction: 0.4 })) }} />);
    expect(container.querySelector('[data-testid="tail-spar"]')?.getAttribute("d")).not.toBe(first);
  });
  it("draws the main wing in the same aircraft coordinates as the tail", () => {
    render(<TailPreview aircraft={aircraft} />);

    expect(screen.getAllByTestId("main-wing-planform")).toHaveLength(2);
    expect(screen.getAllByTestId("main-wing-spar")).toHaveLength(2);
    expect(screen.getByTestId("main-wing-side")).toBeTruthy();
    expect(screen.getByText("主翼")).toBeTruthy();
    expect(screen.getByText("尾翼")).toBeTruthy();
  });

  it("uses one physical scale for main-wing span and chord", () => {
    render(<TailPreview aircraft={aircraft} />);

    const points = parsePolygon(screen.getAllByTestId("main-wing-planform")[0].getAttribute("points") ?? "");
    const renderedSemiSpan = Math.max(...points.map((point) => point.x)) - points[0].x;
    const renderedRootChord = Math.abs(points.at(-1)!.y - points[0].y);

    expect(renderedSemiSpan / renderedRootChord).toBeCloseTo(2 / 1, 5);
  });

  it("keeps the main wing visible before a tail is added", () => {
    render(<TailPreview aircraft={{ ...aircraft, tailSurfaces: [] }} />);

    expect(screen.getAllByTestId("main-wing-planform")).toHaveLength(2);
    expect(screen.getByTestId("main-wing-side")).toBeTruthy();
  });
});

function parsePolygon(value: string) {
  return value.trim().split(/\s+/).map((point) => {
    const [x, y] = point.split(",").map(Number);
    return { x, y };
  });
}
