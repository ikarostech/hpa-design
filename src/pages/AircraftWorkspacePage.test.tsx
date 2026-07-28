import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AircraftWorkspacePage } from "./AircraftWorkspacePage";

const sectionDefaults = {
  xOffset: 0,
  chordwisePanels: 12,
  spanwisePanels: 8,
  chordwiseDistribution: "cosine" as const,
  spanwiseDistribution: "uniform" as const,
};

const aircraft = {
  id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: -3.58, incidence: 0,
  wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8,
  sections: [
    { ...sectionDefaults, id: "root", yPosition: 0, chord: 1, twist: 0, dihedral: 0, airfoilId: "af-1" },
    { ...sectionDefaults, id: "tip", yPosition: 2, chord: 0.5, twist: 0, dihedral: 0, airfoilId: "af-1" },
  ],
};

const airfoils = [{ id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] }];

describe("AircraftWorkspacePage", () => {
  afterEach(cleanup);

  it("derives and saves the wing span from the tip Y position", async () => {
    const user = userEvent.setup();
    const onUpdateAircraft = vi.fn();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={onUpdateAircraft} /></MemoryRouter>);

    const tipPosition = screen.getByLabelText("Section 2 Y position");
    await user.clear(tipPosition);
    await user.type(tipPosition, "3");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onUpdateAircraft).toHaveBeenCalledWith(expect.objectContaining({ span: 6 }));
  });

  it("shows XFLR5-style geometry and mesh fields while fixing the root at Y zero", () => {
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("columnheader", { name: "X Offset" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "X Panels" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Y Distribution" })).toBeTruthy();
    expect((screen.getByLabelText("Section 1 Y position") as HTMLInputElement).disabled).toBe(true);
  });

  it("uses the common right-aligned action column layout", () => {
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    const actionHeader = screen.getByRole("columnheader", { name: "操作" });
    const actionCell = screen.getByRole("button", { name: "Section 1を削除" }).closest("td");

    expect(actionHeader.getAttribute("scope")).toBe("col");
    expect(actionHeader.className).toContain("px-2 py-2 text-right");
    expect(actionCell?.className).toContain("px-2 py-3 text-right");
  });

  it("adds a new root section before the first selected section", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    const addBefore = screen.getByRole("button", { name: "前にセクションを追加" }) as HTMLButtonElement;
    expect(addBefore.disabled).toBe(false);
    await user.click(addBefore);
    expect((screen.getByLabelText("Section 1 Y position") as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText("Section 2 Y position") as HTMLInputElement).value).toBe("1");
    expect(screen.getByRole("row", { name: "Section 2" }).getAttribute("aria-selected")).toBe("true");
  });

  it("adds a section after the selected section", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    const addAfter = screen.getByRole("button", { name: "後ろにセクションを追加" }) as HTMLButtonElement;
    expect(addAfter.disabled).toBe(false);
    await user.click(addAfter);
    expect([1, 2, 3].map((index) => (screen.getByLabelText(`Section ${index} Y position`) as HTMLInputElement).value)).toEqual(["0", "1", "2"]);
  });

  it("saves an edited leading-edge offset", async () => {
    const user = userEvent.setup();
    const onUpdateAircraft = vi.fn();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={onUpdateAircraft} /></MemoryRouter>);

    const offset = screen.getByLabelText("Section 2 X offset");
    await user.clear(offset);
    await user.type(offset, "0.3");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onUpdateAircraft).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.arrayContaining([expect.objectContaining({ id: "tip", xOffset: 0.3 })]),
    }));
  });

  it("confirms before deleting a section", async () => {
    const user = userEvent.setup();
    const threeSectionAircraft = {
      ...aircraft,
      sections: [aircraft.sections[0], { ...aircraft.sections[1], id: "mid", yPosition: 1, chord: 0.75 }, aircraft.sections[1]],
    };
    render(<MemoryRouter><AircraftWorkspacePage aircraft={threeSectionAircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    expect((screen.getByRole("button", { name: "Section 1を削除" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Section 2を削除" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(screen.queryByLabelText("Section 3 Y position")).toBeNull();
  });

  it("synchronizes the selected section between the table and preview", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AircraftWorkspacePage aircraft={aircraft} airfoils={airfoils} onUpdateAircraft={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "上面図のSection 2を選択" }));
    expect(screen.getByRole("row", { name: "Section 2" }).getAttribute("aria-selected")).toBe("true");

    await user.click(screen.getByRole("row", { name: "Section 1" }));
    expect(screen.getByRole("button", { name: "上面図のSection 1を選択" }).getAttribute("aria-current")).toBe("true");
  });
});
