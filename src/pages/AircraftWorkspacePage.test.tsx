import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AircraftWorkspacePage } from "./AircraftWorkspacePage";

const aircraft = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0,
  wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8,
  sections: [
    { id: "root", spanPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" as const },
    { id: "tip", spanPosition: 2, chord: 0.5, twist: 0, dihedral: 0, airfoilId: "af-1", controlSurface: "none" as const },
  ],
};

describe("AircraftWorkspacePage", () => {
  afterEach(cleanup);

  it("saves a validated wing span edit", async () => {
    const user = userEvent.setup();
    const onUpdateAircraft = vi.fn();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={[{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] }]} onUpdateAircraft={onUpdateAircraft} /></MemoryRouter>);

    const spanInput = screen.getByLabelText("スパン");
    await user.clear(spanInput);
    await user.type(spanInput, "6");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onUpdateAircraft).toHaveBeenCalledWith(expect.objectContaining({ span: 6 }));
  });

  it("right-aligns section row action controls", () => {
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={[{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] }]} onUpdateAircraft={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Section 1 delete" }).parentElement?.className).toContain("justify-end");
  });
});
