import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { aircraftGeometry, carbonMaterials, structuralDesigns } from "../mocks/mockData";
import { StructuresPage } from "./StructuresPage";

describe("StructuresPage", () => {
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
    expect(screen.getByText("翼幅方向結果")).toBeTruthy();
    expect(screen.getByRole("button", { name: "構造結果CSVを保存" })).toBeTruthy();
  });
});
