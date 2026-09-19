import { cleanup, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { CarbonMaterial, StructuralDesign } from "../../structures/model/types";
import { AeroelasticAnalysisPanel } from "./AeroelasticAnalysisPanel";
import { executeStaticAeroelasticAnalysis } from "../services/staticAeroelasticSolver";
import { JobProvider } from "../../../shared/jobs/JobProvider";
import { JobStatusButton } from "../../../shared/jobs/JobStatusButton";
import type { ReactNode } from "react";

function render(ui: ReactNode) { return rtlRender(<JobProvider>{ui}</JobProvider>); }

const aircraft: AircraftGeometry = {
  id: "wing", span: 2, rootChord: 0.8, tipChord: 0.6, taperRatio: 0.75, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 1.4, aspectRatio: 2.857, mac: 0.705, staticMargin: 0,
  sections: [
    { id: "root", yPosition: 0, chord: 0.8, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 3, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
    { id: "tip", yPosition: 1, chord: 0.6, xOffset: 0, twist: 0, dihedral: 0, airfoilId: "af", chordwisePanels: 2, spanwisePanels: 3, chordwiseDistribution: "uniform", spanwiseDistribution: "uniform" },
  ],
};
const material: CarbonMaterial = { id: "carbon", name: "Carbon", e1: 140e9, e2: 9e9, g12: 5e9, nu12: 0.3, tensileStrength1: 1500e6, compressiveStrength1: 800e6, tensileStrength2: 50e6, compressiveStrength2: 150e6, shearStrength12: 80e6, density: 1550, plyThickness: 0.0002, reductionFactor: 0.8 };
const design: StructuralDesign = { id: "spar", name: "Main spar", sections: [{ id: "tube", length: 1, outerDiameter: 0.1, plies: [{ id: "p0", materialId: material.id, angle: 0, count: 20 }, { id: "p45", materialId: material.id, angle: 45, count: 4 }] }], loadCases: [] };

afterEach(cleanup);

describe("AeroelasticAnalysisPanel", () => {
  it("starts fixed-angle analysis at 7.4 m/s and 5 degrees", () => {
    render(<AeroelasticAnalysisPanel aircraft={aircraft} materials={[material]} structuralDesigns={[design]} results={[]} onSaveResult={vi.fn()} />);

    expect((screen.getByLabelText("速度 (m/s)") as HTMLInputElement).value).toBe("7.4");
    expect((screen.getByLabelText("迎角 (°)") as HTMLInputElement).value).toBe("5");
  });

  it("explains why analysis is unavailable without a structural design", () => {
    render(<AeroelasticAnalysisPanel aircraft={aircraft} materials={[]} structuralDesigns={[]} results={[]} onSaveResult={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "空力構造連成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成解析を実行" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/構造設計を作成/)).toBeTruthy();
  });

  it("runs and presents a converged coupled result", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<AeroelasticAnalysisPanel aircraft={aircraft} materials={[material]} structuralDesigns={[design]} results={[]} analysisRunner={{ run: async (input) => executeStaticAeroelasticAnalysis(input) }} onSaveResult={save} />);

    await user.click(screen.getByRole("button", { name: "連成解析を実行" }));

    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(screen.getAllByText("収束").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "変形前後の主翼形状" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "翼幅方向の空力・曲げ分布" })).toBeNull();
    expect(screen.queryByRole("img", { name: "翼幅方向のねじり分布" })).toBeNull();
    expect(screen.getByRole("heading", { name: "反復履歴" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成結果をCSV出力" })).toBeTruthy();
  });

  it("registers and reports a coupled-analysis job while the worker is running", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const result = executeStaticAeroelasticAnalysis({ resultId: "fsi-worker", aircraft, structuralDesign: design, materials: [material], density: 1.225, speed: 10, elasticAxisChordFraction: 0.4, condition: { mode: "fixed-alpha", alphaDegrees: 4 } });
    let finish!: (value: typeof result) => void;
    let reportProgress!: (progress: { completed: number; total: number; message?: string }) => void;
    const pending = new Promise<typeof result>((resolve) => { finish = resolve; });
    const analysisRunner = { run: vi.fn((_input, _signal, onProgress) => { reportProgress = onProgress; return pending; }) };
    render(<><JobStatusButton /><AeroelasticAnalysisPanel aircraft={aircraft} materials={[material]} structuralDesigns={[design]} results={[]} analysisRunner={analysisRunner} onSaveResult={save} /></>);

    await user.click(screen.getByRole("button", { name: "連成解析を実行" }));

    expect(screen.getByRole("button", { name: "連成解析をキャンセル" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "解析中 1" })).toBeTruthy();
    reportProgress({ completed: 2, total: 50, message: "連成反復 2/50" });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("連成反復 2/50"));
    expect(save).not.toHaveBeenCalled();

    finish(result);
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: "fsi-worker" })));
  });
});
