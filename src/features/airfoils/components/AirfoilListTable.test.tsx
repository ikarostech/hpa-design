import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirfoilListTable } from "./AirfoilListTable";

const airfoil = { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] };
const inspector = { state: { open: false, mode: "detail" as const, targetId: null }, openDetail: vi.fn(), openCreate: vi.fn(), openEdit: vi.fn(), close: vi.fn() };
const targets = { selectedIds: [airfoil.id], isSelected: () => true, toggle: vi.fn(), replace: vi.fn(), clear: vi.fn() };

describe("AirfoilListTable", () => {
  afterEach(cleanup);
  it("starts both creation workflows from the airfoil table", async () => {
    const user = userEvent.setup();
    const onCreateNaca = vi.fn();
    const onImportDat = vi.fn();
    render(<AirfoilListTable airfoils={[airfoil]} airfoilPolars={[]} detailInspector={inspector} analysisTargets={targets} onCreateNaca={onCreateNaca} onImportDat={onImportDat} onEdit={vi.fn()} onRemove={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "NACA生成" }));
    await user.click(screen.getByRole("button", { name: ".datを読み込む" }));

    expect(onCreateNaca).toHaveBeenCalledTimes(1);
    expect(onImportDat).toHaveBeenCalledTimes(1);
  });

  it("uses labelled icon controls for detail, edit, and delete", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<AirfoilListTable airfoils={[airfoil]} airfoilPolars={[]} detailInspector={inspector} analysisTargets={targets} onCreateNaca={vi.fn()} onImportDat={vi.fn()} onEdit={onEdit} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: "NACA0012を詳細表示" }));
    await user.click(screen.getByRole("button", { name: "NACA0012を編集" }));
    await user.click(screen.getByRole("button", { name: "NACA0012を削除" }));

    expect(inspector.openDetail).toHaveBeenCalledWith(airfoil.id);
    expect(onEdit).toHaveBeenCalledWith(airfoil.id);
    expect(onRemove).toHaveBeenCalledWith(airfoil.id);
  });
});
