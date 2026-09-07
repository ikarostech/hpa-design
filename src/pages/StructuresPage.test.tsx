import { cleanup, fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftGeometry, carbonMaterials, structuralDesigns } from "../mocks/mockData";
import { executeStructuralAnalysis } from "../features/structures/services/structuralAnalysis";
import { StructuresPage } from "./StructuresPage";
import { JobProvider } from "../shared/jobs/JobProvider";
import { JobStatusButton } from "../shared/jobs/JobStatusButton";
import type { ReactNode } from "react";

function render(ui: ReactNode) { return rtlRender(<JobProvider>{ui}</JobProvider>); }

afterEach(cleanup);

describe("StructuresPage", () => {
  it("confirms before deleting the selected structural design", async () => {
    const user = userEvent.setup();
    const removeDesign = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={vi.fn()} onRemoveDesign={removeDesign} onSaveResult={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "主翼メインパイプを削除" }));

    const dialog = screen.getByRole("alertdialog", { name: "構造案を削除" });
    expect(within(dialog).getByText(/関連する解析結果も削除/)).toBeTruthy();
    expect(removeDesign).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    expect(removeDesign).toHaveBeenCalledWith("main-spar-1");
  });

  it("blocks deletion of a material referenced by a pipe layup", async () => {
    const user = userEvent.setup();
    const removeMaterial = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={removeMaterial} onSaveDesign={vi.fn()} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "T700 UD（設計値）を削除" }));

    const dialog = screen.getByRole("alertdialog", { name: "材料を削除" });
    expect(within(dialog).getByText(/3本のパイプセクションで使用中/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "削除する" })).toHaveProperty("disabled", true);
    expect(removeMaterial).not.toHaveBeenCalled();
  });

  it("confirms before deleting a pipe section", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "spar-midを削除" }));

    const dialog = screen.getByRole("alertdialog", { name: "パイプセクションを削除" });
    expect(saveDesign).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.not.arrayContaining([expect.objectContaining({ id: "spar-mid" })]),
    }));
  });

  it("confirms before deleting a structural support", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    const designWithSupport = { ...structuralDesigns[0], supports: [{ id: "support-1", yPosition: 0.8, kind: "rigid" as const }] };
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={[designWithSupport]} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "支持点1を削除" }));

    const dialog = screen.getByRole("alertdialog", { name: "支持点を削除" });
    expect(saveDesign).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({ supports: [] }));
  });

  it("organizes structural concepts, baseline loads, and uncoupled analysis as one design workspace", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={vi.fn()} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["構造案", "基準荷重", "単独解析"]);
    expect(screen.getByRole("img", { name: "パイプ設計の曲げ強度と破壊モード" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "パイプ設計の曲げ剛性" })).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "基準荷重" }));
    expect(screen.getByRole("heading", { name: "構造荷重ケース" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "巡航楕円荷重をグラフに表示" })).toBeTruthy();
  });

  it("runs a baseline load case and moves to uncoupled analysis", async () => {
    const user = userEvent.setup();
    const saveResult = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} analysisRunner={{ run: async (input) => executeStructuralAnalysis(input) }} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={vi.fn()} onRemoveDesign={vi.fn()} onSaveResult={saveResult} /></MemoryRouter>);

    await user.click(screen.getByRole("tab", { name: "基準荷重" }));
    await user.click(screen.getByRole("button", { name: "巡航楕円荷重を解析" }));

    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(expect.objectContaining({ designId: "main-spar-1", loadCaseId: "structure-load-cruise", status: "completed" })));
    expect(screen.getByRole("tab", { name: "単独解析" }).getAttribute("aria-selected")).toBe("true");
  });

  it("registers a structural analysis job while the worker result is pending", async () => {
    const user = userEvent.setup();
    const saveResult = vi.fn();
    let finish!: (result: ReturnType<typeof executeStructuralAnalysis>) => void;
    const pendingResult = new Promise<ReturnType<typeof executeStructuralAnalysis>>((resolve) => { finish = resolve; });
    const analysisRunner = { run: vi.fn(() => pendingResult) };
    render(<MemoryRouter><JobProvider><JobStatusButton /><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} analysisRunner={analysisRunner} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={vi.fn()} onRemoveDesign={vi.fn()} onSaveResult={saveResult} /></JobProvider></MemoryRouter>);

    await user.click(screen.getByRole("tab", { name: "基準荷重" }));
    await user.click(screen.getByRole("button", { name: "巡航楕円荷重を解析" }));

    expect(screen.getByRole("button", { name: "巡航楕円荷重の解析をキャンセル" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("巡航楕円荷重を解析中");
    expect(screen.getByRole("button", { name: "解析中 1" })).toBeTruthy();
    expect(saveResult).not.toHaveBeenCalled();

    finish(executeStructuralAnalysis({ design: structuralDesigns[0], loadCase: structuralDesigns[0].loadCases[0], materials: carbonMaterials, resultId: "result-worker" }));
    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(expect.objectContaining({ id: "result-worker" })));
  });

  it("opens carbon material properties in a right-side drawer and saves edits", async () => {
    const user = userEvent.setup();
    const saveMaterial = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={saveMaterial} onRemoveMaterial={vi.fn()} onSaveDesign={vi.fn()} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    expect(screen.queryByRole("heading", { name: "材料プロパティ" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "T700 UD（設計値）を編集" }));

    const detail = screen.getByRole("dialog", { name: "材料プロパティ" });
    const e1Input = within(detail).getByRole("spinbutton", { name: "E1" });
    expect(e1Input).toHaveProperty("value", "125");
    fireEvent.change(e1Input, { target: { value: "130" } });
    expect(saveMaterial).toHaveBeenCalledWith(expect.objectContaining({ id: "carbon-t700-ud", e1: 130e9 }));
  });

  it("opens a pipe detail view with the selected pipe's own layup", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    expect(screen.queryByRole("heading", { name: "セクション積層構成" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "spar-midを詳細表示" }));

    const detail = screen.getByRole("dialog", { name: "パイプ詳細" });
    expect(within(detail).getByRole("heading", { name: "このパイプの積層構成" })).toBeTruthy();
    expect(within(detail).getByText("0.400–1.200 m")).toBeTruthy();
    const countInput = within(detail).getByRole("spinbutton", { name: "mid-0の詳細層数" });
    expect(countInput).toHaveProperty("value", "6");
    expect(within(detail).getByRole("combobox", { name: "mid-0の詳細材料" })).toHaveProperty("value", "carbon-t700-ud");
    expect(within(detail).getByRole("combobox", { name: "mid-0の詳細角度" })).toHaveProperty("value", "0");

    fireEvent.change(countInput, { target: { value: "7" } });
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({
      sections: expect.arrayContaining([
        expect.objectContaining({ id: "spar-root", plies: expect.arrayContaining([expect.objectContaining({ id: "root-0", count: 8 })]) }),
        expect.objectContaining({ id: "spar-mid", plies: expect.arrayContaining([expect.objectContaining({ id: "mid-0", count: 7 })]) }),
      ]),
    }));

    await user.click(within(detail).getByRole("button", { name: "積層を追加" }));
    const addedDesign = saveDesign.mock.calls.at(-1)?.[0];
    const addedMidSection = addedDesign.sections.find((section: { id: string }) => section.id === "spar-mid");
    expect(addedMidSection.plies).toHaveLength(4);
    expect(addedMidSection.plies[3]).toEqual(expect.objectContaining({ materialId: "carbon-t700-ud", angle: 0, count: 1 }));

    await user.click(within(detail).getByRole("button", { name: "mid-45mの詳細積層を削除" }));
    const removedDesign = saveDesign.mock.calls.at(-1)?.[0];
    const removedMidSection = removedDesign.sections.find((section: { id: string }) => section.id === "spar-mid");
    expect(removedMidSection.plies.map((ply: { id: string }) => ply.id)).toEqual(["mid-0", "mid-45p"]);
  });

  it("edits the spar and exposes existing result inspection", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    const result = executeStructuralAnalysis({
      design: structuralDesigns[0],
      loadCase: structuralDesigns[0].loadCases[0],
      materials: carbonMaterials,
      resultId: "result-1",
    });
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[result]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "構造設計" })).toBeTruthy();
    expect(screen.getAllByText("T700 UD（設計値）").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "CFRPパイプセクション" })).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton", { name: "セクション長さ" }), { target: { value: "0.5" } });
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ id: "spar-root", length: 0.5 })]) }));
    await user.click(screen.getByRole("tab", { name: "単独解析" }));

    expect(screen.getByText("最小安全率")).toBeTruthy();
    expect(screen.getByText("パイプ固有特性")).toBeTruthy();
    expect(screen.getByText("荷重ケース応答")).toBeTruthy();
    expect(screen.getByRole("button", { name: "構造結果CSVを保存" })).toBeTruthy();
  });
});
