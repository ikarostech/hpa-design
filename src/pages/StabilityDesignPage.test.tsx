import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobProvider } from "../shared/jobs/JobProvider";
import { StabilityDesignPage } from "./StabilityDesignPage";
import { createStabilityWingMesh } from "../features/analysis/services/stabilityShape";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const aircraft = { id: "aircraft", span: 4, rootChord: 1, tipChord: 1, taperRatio: 1, twist: 0, dihedral: 0,
  sweep: 0, incidence: 0, wingArea: 4, aspectRatio: 4, mac: 1, staticMargin: 0,
  sections: [0, 2].map((yPosition, i) => ({ id: `s${i}`, yPosition, chord: 1, xOffset: 0, twist: 0, dihedral: 0,
    airfoilId: "foil", chordwisePanels: 1, spanwisePanels: 2, chordwiseDistribution: "uniform" as const, spanwiseDistribution: "uniform" as const })) };
const props = { aircraft, cases: [], results: [], polars: [],
  analysisCaseRepository: { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }, saveAnalysisResult: vi.fn() };

describe("StabilityDesignPage", () => {
  it("shows stability tabs without the introductory FSI cards", () => {
    render(<MemoryRouter initialEntries={["/stability"]}><JobProvider><StabilityDesignPage {...props} /></JobProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "安定性設計" })).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "空力設計" })).toBeNull();
    expect(screen.getByRole("tab", { name: "尾翼設計" }).getAttribute("href")).toBe("/stability/tails");
    expect(screen.getByRole("tab", { name: "安定性解析" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText(/FSI前の簡易評価/)).toBeNull();
    expect(screen.queryByText(/FSI後の評価はFSIページへ/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: "主翼" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "構造" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "尾翼" })).toBeNull();
  });

  it("offers rigid and manual initial design without an FSI shape selector", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    render(<MemoryRouter initialEntries={["/stability"]}><JobProvider><StabilityDesignPage {...props} analysisCaseRepository={{ ...props.analysisCaseRepository, save }} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "Initial design");
    const editor = within(screen.getByRole("dialog", { name: "解析ケースを新規作成" }));
    expect(editor.getByRole("combobox", { name: "主翼" })).toBeTruthy();
    expect(editor.getByRole("combobox", { name: "構造" })).toBeTruthy();
    expect(editor.getByRole("combobox", { name: "尾翼" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /FSI/ })).toBeNull();
    await user.selectOptions(screen.getByRole("combobox", { name: "評価形状" }), "manual");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ stabilityShape: expect.objectContaining({ kind: "manual" }) }));
  });
  it.each(["current", "none"])("saves the %s tail selection with the main wing", async (tailSelection) => {
    const user = userEvent.setup(); const save = vi.fn();
    const tail = { id: "tail", name: "Horizontal", orientation: "horizontal" as const, rootPosition: { x: 4, y: 0, z: 0 },
      incidence: -2, symmetric: true, isDoubleFin: false, isSymmetricFin: false,
      sections: [0, 1].map((spanPosition, index) => ({ id: `t${index}`, spanPosition, chord: 0.5, xOffset: 0,
        dihedral: 0, twist: 0, leftAirfoilId: "foil", rightAirfoilId: "foil", chordwisePanels: 1, spanwisePanels: 2,
        chordwiseDistribution: "uniform" as const, spanwiseDistribution: "uniform" as const })) };
    render(<MemoryRouter initialEntries={["/stability"]}><JobProvider><StabilityDesignPage {...props} aircraft={{ ...aircraft, tailSurfaces: [tail] }}
      analysisCaseRepository={{ ...props.analysisCaseRepository, save }} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "尾翼" }), tailSelection);
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "Selected tails");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    expect(save.mock.calls[0][0].stabilityGeometry.tailSurfaces).toEqual(tailSelection === "current" ? [tail] : []);
    tail.incidence = 99;
    if (tailSelection === "current") expect(save.mock.calls[0][0].stabilityGeometry.tailSurfaces[0].incidence).toBe(-2);
  });
  it("imports completed standalone deformation into a saved, independent stability case", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    const source = { id: "structural-1", status: "completed" as const, createdAt: "2026-10-16T00:00:00Z",
      designSnapshot: { name: "Spar" }, loadCaseSnapshot: { name: "1G", loadFactor: 1, safetyFactor: 1.5 },
      points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.3, twist: -4 }] };
    render(<MemoryRouter initialEntries={["/stability"]}><JobProvider><StabilityDesignPage {...props} structuralResults={[source,
      { ...source, id: "stale", status: "needs-review" },
      { ...source, id: "short", points: [source.points[0], { ...source.points[1], yPosition: 1 }] },
      { ...source, id: "invalid", points: [source.points[0], { ...source.points[1], twist: NaN }] }
    ]} analysisCaseRepository={{ ...props.analysisCaseRepository, save }} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    const selector = screen.getByRole("combobox", { name: "構造" });
    expect(selector.querySelectorAll("option")).toHaveLength(2);
    expect(screen.getByRole("option", { name: /Spar \/ 1G \/ 荷重係数 1・安全率 1.5/ })).toBeTruthy();
    await user.selectOptions(selector, source.id);
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "Structural stability");
    expect(screen.getByRole("spinbutton", { name: "点2 たわみ (m)" })).toHaveProperty("value", "0.3");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({ scope: "aircraft", method: "VLM", stabilityShape: {
      kind: "manual", elasticAxisChordFraction: 0.35, points: source.points } });
    expect(saved.stabilityGeometry.sections).toEqual(aircraft.sections);
    source.points[1].deflection = 99;
    expect(saved.stabilityShape.points[1].deflection).toBe(0.3);
    const mesh = createStabilityWingMesh(aircraft, saved.stabilityShape);
    expect(mesh.nodes.some((n) => n.y === 2 && n.z > 0.2)).toBe(true);
    expect(mesh.nodes.some((n) => n.y === -2 && n.z > 0.2)).toBe(true);
  });
  it("keeps saved geometry and deformation visible when the source result is no longer available", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    const savedCase = { id: "saved", name: "Saved stability", method: "VLM" as const, scope: "aircraft" as const,
      geometryId: aircraft.id, status: "not-run" as const, alphaStart: 0, alphaEnd: 4, alphaStep: 2, speed: 10, altitude: 0, reynolds: 100000,
      stabilityGeometry: { ...aircraft, incidence: 3 }, stabilityShape: { kind: "manual" as const, elasticAxisChordFraction: 0.35,
        points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.3, twist: -4 }] } };
    render(<MemoryRouter initialEntries={["/stability"]}><JobProvider><StabilityDesignPage {...props} cases={[savedCase]}
      analysisCaseRepository={{ ...props.analysisCaseRepository, save }} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "Saved stabilityを編集" }));
    const editor = within(screen.getByRole("dialog", { name: "解析ケースを編集" }));
    expect((editor.getByRole("combobox", { name: "主翼" }) as HTMLSelectElement).selectedOptions[0].textContent).toContain("保存済み");
    expect((editor.getByRole("combobox", { name: "構造" }) as HTMLSelectElement).selectedOptions[0].textContent).toContain("保存済み");
    await user.click(editor.getByRole("button", { name: "解析ケースを保存" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ stabilityGeometry: savedCase.stabilityGeometry, stabilityShape: savedCase.stabilityShape }));
  });
});
