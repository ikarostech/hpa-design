import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftGeometry, carbonMaterials, structuralDesigns } from "../mocks/mockData";
import { StructuresPage } from "./StructuresPage";

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

  it("confirms before deleting a structural load case", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole("tab", { name: "荷重ケース" }));

    await user.click(screen.getByRole("button", { name: "巡航楕円荷重を削除" }));

    const dialog = screen.getByRole("alertdialog", { name: "荷重ケースを削除" });
    expect(saveDesign).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "削除する" }));
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({ loadCases: [] }));
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

  it("edits the spar, runs a load case, and exposes result inspection", async () => {
    const user = userEvent.setup();
    const saveDesign = vi.fn();
    const saveResult = vi.fn();
    const { rerender } = render(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={saveResult} /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "主翼カーボンパイプ構造設計" })).toBeTruthy();
    expect(screen.getAllByText("T700 UD（設計値）").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "CFRPパイプセクション" })).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton", { name: "セクション長さ" }), { target: { value: "0.5" } });
    expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({ sections: expect.arrayContaining([expect.objectContaining({ id: "spar-root", length: 0.5 })]) }));
    await user.click(screen.getByRole("tab", { name: "荷重ケース" }));
    await user.click(screen.getByRole("button", { name: "巡航楕円荷重を解析" }));

    expect(saveResult).toHaveBeenCalledWith(expect.objectContaining({ designId: "main-spar-1", loadCaseId: "structure-load-cruise", status: "completed" }));
    const result = saveResult.mock.calls[0][0];
    rerender(<MemoryRouter><StructuresPage aircraft={aircraftGeometry} aerodynamicResults={[]} materials={carbonMaterials} designs={structuralDesigns} results={[result]} onSaveMaterial={vi.fn()} onRemoveMaterial={vi.fn()} onSaveDesign={saveDesign} onRemoveDesign={vi.fn()} onSaveResult={saveResult} /></MemoryRouter>);
    await user.click(screen.getByRole("tab", { name: "結果" }));

    expect(screen.getByText("最小RF")).toBeTruthy();
    expect(screen.getByText("パイプ固有特性")).toBeTruthy();
    expect(screen.getByText("荷重ケース応答")).toBeTruthy();
    expect(screen.getByRole("button", { name: "構造結果CSVを保存" })).toBeTruthy();
  });
});
