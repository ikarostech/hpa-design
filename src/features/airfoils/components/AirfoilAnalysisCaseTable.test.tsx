import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirfoilAnalysisCaseTable } from "./AirfoilAnalysisCaseTable";

const airfoil = { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] };
const run = { id: "run-1", name: "baseline", airfoilIds: [airfoil.id], polarIds: ["polar-1"], createdAt: "2026-07-18T00:00:00.000Z", reynolds: 300000, mach: 0.04, alphaStart: -4, alphaEnd: 12, alphaStep: 2, status: "complete" as const };
const displayedRuns = { state: { displayedResultIds: [run.id], primaryResultId: run.id, compareMode: false }, show: vi.fn(), hide: vi.fn(), setPrimary: vi.fn(), clear: vi.fn() };
const baseProps = { airfoils: [airfoil], displayedRuns, comparisonLimitReached: false, maxComparisonRuns: 6, onCreateRun: vi.fn(), onOpenDetail: vi.fn(), onRetryRun: vi.fn(), onDuplicateRun: vi.fn(), onRenameRun: vi.fn(), onDeleteRun: vi.fn() };

describe("AirfoilAnalysisCaseTable", () => {
  afterEach(cleanup);
  it("shows an empty state when no analysis runs exist", () => {
    render(<AirfoilAnalysisCaseTable {...baseProps} runs={[]} onExportRun={vi.fn()} />);
    expect(screen.getByText("条件に一致する解析 Run はありません。解析を開始して結果を追加してください。")).toBeTruthy();
  });

  it("uses a labelled dropdown trigger and fixed-position format menu for exports", async () => {
    const user = userEvent.setup();
    const onExportRun = vi.fn();
    render(<AirfoilAnalysisCaseTable {...baseProps} runs={[run]} onExportRun={onExportRun} />);
    const trigger = screen.getByRole("button", { name: "baselineを出力形式から選択" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu").className).toContain("fixed");
    await user.click(screen.getByRole("menuitem", { name: "JSON" }));
    expect(onExportRun).toHaveBeenCalledWith(run, "json");
  });

  it("opens run details from the common information icon", async () => {
    const user = userEvent.setup();
    const onOpenDetail = vi.fn();
    render(<AirfoilAnalysisCaseTable {...baseProps} runs={[run]} onOpenDetail={onOpenDetail} onExportRun={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "baselineを詳細表示" }));
    expect(onOpenDetail).toHaveBeenCalledWith(run);
  });

  it("uses a retry icon for rerunning an analysis", () => {
    render(<AirfoilAnalysisCaseTable {...baseProps} runs={[run]} onExportRun={vi.fn()} />);
    expect(screen.getByRole("button", { name: "baselineを再実行" }).querySelector("svg.lucide-rotate-ccw")).toBeTruthy();
  });

  it("right-aligns the row action controls", () => {
    render(<AirfoilAnalysisCaseTable {...baseProps} runs={[run]} onExportRun={vi.fn()} />);
    expect(screen.getByRole("button", { name: "baselineを再実行" }).parentElement?.className).toContain("justify-end");
  });
});
