import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AircraftGeometry } from "../model/types";
import { TailPreview } from "./TailPreview";

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
  it("draws the main wing in the same aircraft coordinates as the tail", () => {
    render(<TailPreview aircraft={aircraft} />);

    expect(screen.getAllByTestId("main-wing-planform")).toHaveLength(2);
    expect(screen.getByTestId("main-wing-side")).toBeTruthy();
    expect(screen.getByText("主翼")).toBeTruthy();
    expect(screen.getByText("尾翼")).toBeTruthy();
  });

  it("uses one physical scale for main-wing span and chord", () => {
    render(<TailPreview aircraft={aircraft} />);

    const points = parsePolygon(screen.getAllByTestId("main-wing-planform")[0].getAttribute("points") ?? "");
    const renderedSemiSpan = Math.abs(points[1].x - points[0].x);
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
