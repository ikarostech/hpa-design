import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AircraftGeometry } from "../model/types";
import { AircraftPreview } from "./AircraftPreview";

const defaults = {
  chordwisePanels: 4,
  spanwisePanels: 3,
  chordwiseDistribution: "cosine" as const,
  spanwiseDistribution: "uniform" as const,
};

const geometry: AircraftGeometry = {
  id: "wing",
  span: 4,
  rootChord: 1,
  tipChord: 0.5,
  taperRatio: 0.5,
  twist: -2,
  dihedral: 7.5,
  sweep: 4,
  incidence: 0,
  wingArea: 3,
  aspectRatio: 5.333,
  mac: 0.778,
  staticMargin: 8,
  sections: [
    { ...defaults, id: "root", yPosition: 0, chord: 1, xOffset: 0, twist: 0, dihedral: 5, airfoilId: "af-1" },
    { ...defaults, id: "mid", yPosition: 1, chord: 0.8, xOffset: 0.1, twist: -1, dihedral: 10, airfoilId: "af-1" },
    { ...defaults, id: "tip", yPosition: 2, chord: 0.5, xOffset: 0.4, twist: -2, dihedral: 0, airfoilId: "af-1" },
  ],
};

describe("AircraftPreview", () => {
  afterEach(cleanup);

  it("renders plan and front views from every wing section", () => {
    render(<AircraftPreview geometry={geometry} />);

    expect(screen.getByText("上面図")).toBeTruthy();
    expect(screen.getByText("正面図")).toBeTruthy();
    expect(screen.getAllByTestId("planform-section")).toHaveLength(3);
    expect(screen.getAllByTestId("front-section")).toHaveLength(3);
    expect(screen.getAllByTestId("mesh-line").length).toBeGreaterThan(3);
  });

  it("allows a section to be selected from the preview", () => {
    const onSelectSection = vi.fn();
    render(<AircraftPreview geometry={geometry} selectedSectionId="root" onSelectSection={onSelectSection} />);

    fireEvent.click(screen.getByRole("button", { name: "上面図のSection 2を選択" }));

    expect(onSelectSection).toHaveBeenCalledWith("mid");
  });

  it("allows a section to be selected from the front-view point", () => {
    const onSelectSection = vi.fn();
    render(<AircraftPreview geometry={geometry} selectedSectionId="root" onSelectSection={onSelectSection} />);

    fireEvent.click(screen.getByRole("button", { name: "正面図のSection 2を選択" }));

    expect(onSelectSection).toHaveBeenCalledWith("mid");
  });
});
