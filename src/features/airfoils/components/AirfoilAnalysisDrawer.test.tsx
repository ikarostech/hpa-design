import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirfoilAnalysisDrawer } from "./AirfoilAnalysisDrawer";

const targets = { selectedIds: ["af-1"], isSelected: () => true, toggle: vi.fn(), replace: vi.fn(), clear: vi.fn() };
const jobs = { jobs: [], currentJob: null, run: vi.fn(), cancel: vi.fn(), clearCompleted: vi.fn() };
const airfoil = { id: "af-1", name: "NACA0012", thicknessRatio: 12, maxCamber: 0, leadingEdgeRadius: 1, trailingEdgeThickness: 0, coordinates: [] };

describe("AirfoilAnalysisDrawer", () => {
  afterEach(cleanup);

  it("uses the project's representative Reynolds number for a new analysis", () => {
    render(<AirfoilAnalysisDrawer open defaultReynolds={450000} airfoils={[airfoil]} airfoilPolars={[]} analysisTargets={targets} targetNames={[airfoil.name]} jobController={jobs} onClose={vi.fn()} />);

    expect((screen.getByLabelText("Re数") as HTMLInputElement).value).toBe("450000");
  });

  it("shows a field error and blocks execution for a zero alpha step", async () => {
    const user = userEvent.setup();
    render(<AirfoilAnalysisDrawer open airfoils={[airfoil]} airfoilPolars={[]} analysisTargets={targets} targetNames={[airfoil.name]} jobController={jobs} onClose={vi.fn()} />);

    const stepInput = screen.getByLabelText("刻み");
    await user.clear(stepInput);
    await user.type(stepInput, "0");

    expect(screen.getByText("α刻みは正の有限値にしてください。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "1件を一括解析" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("cancels the running analysis from its progress area", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    render(<AirfoilAnalysisDrawer open airfoils={[airfoil]} airfoilPolars={[]} analysisTargets={targets} targetNames={[airfoil.name]} jobController={{ ...jobs, currentJob: { id: "job-1", kind: "airfoil-analysis", name: "test", status: "running", createdAt: "2026-01-01", targetAirfoilIds: [airfoil.id], progress: { completed: 0, total: 1 } }, cancel }} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "解析をキャンセル" }));
    expect(cancel).toHaveBeenCalledWith("job-1");
  });
});
