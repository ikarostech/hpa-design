import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import { TailDesignPage } from "./TailDesignPage";

const aircraft: AircraftGeometry = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0,
  incidence: 0, wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8,
  sections: [],
  tailSurfaces: [{
    id: "tail-1", name: "水平尾翼", orientation: "horizontal", rootPosition: { x: 4, y: 0, z: 0.2 }, incidence: -1,
    sections: [
      { id: "root", spanPosition: 0, chord: 0.8, xOffset: 0, dihedral: 0, twist: 0, leftAirfoilId: "af-1", rightAirfoilId: "af-1", chordwisePanels: 8, spanwisePanels: 6, chordwiseDistribution: "cosine", spanwiseDistribution: "cosine" },
      { id: "tip", spanPosition: 1.5, chord: 0.4, xOffset: 0.2, dihedral: 0, twist: 0, leftAirfoilId: "af-1", rightAirfoilId: "af-1", chordwisePanels: 8, spanwisePanels: 1, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform" },
    ],
    symmetric: true, isDoubleFin: false, isSymmetricFin: false,
  }],
};
const airfoils = [{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] }];

afterEach(cleanup);

describe("TailDesignPage", () => {
  it("shows saved tails and derived geometry on the dedicated tab", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><TailDesignPage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("img", { name: "尾翼配置プレビュー" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "水平尾翼", level: 2 })).toBeTruthy();
    expect(screen.getAllByText("1.800 m²")).toHaveLength(2);
    expect(screen.getByText("3.000 m")).toBeTruthy();
    expect(screen.getByText("ELEVATOR")).toBeTruthy();
  });

  it("edits tail sections inline with the same table pattern as the main wing", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><TailDesignPage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    for (const heading of ["Y Position", "Chord", "X Offset", "Dihedral", "Twist", "Right Foil", "Left Foil", "X Panels", "X Dist", "Y Panels", "Y Dist"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "後ろにセクションを追加" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "水平尾翼を編集" })).toBeNull();
  });

  it("adds a complete tail table and saves it through the page-level action", async () => {
    const user = userEvent.setup();
    const onUpdateAircraft = vi.fn();
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><TailDesignPage aircraft={{ ...aircraft, tailSurfaces: [] }} airfoils={airfoils} onUpdateAircraft={onUpdateAircraft} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "尾翼を追加" }));
    expect(screen.getByRole("heading", { name: "水平尾翼", level: 2 })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Y Position" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "尾翼設計を保存" }));

    expect(onUpdateAircraft).toHaveBeenCalledWith({ tailSurfaces: [expect.objectContaining({ orientation: "horizontal", name: "水平尾翼" })] });
  });

  it("adds another independent section table for each new tail", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><TailDesignPage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "尾翼を追加" }));

    expect(screen.getAllByRole("columnheader", { name: "Y Position" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "水平尾翼 2", level: 2 })).toBeTruthy();
  });
});
