import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobProvider } from "../shared/jobs/JobProvider";
import { createWingAnalysisMesh } from "../features/analysis/services/wingAnalysisMesh";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import type { AircraftAnalysisInput } from "../features/analysis/services/webAircraftAnalysisRunner";
import { FsiStabilityWorkspace } from "./FsiStabilityWorkspace";

afterEach(cleanup);
const aircraft = { id: "aircraft", span: 4, rootChord: 1, tipChord: 1, taperRatio: 1, twist: 0, dihedral: 0,
  sweep: 0, incidence: 0, wingArea: 4, aspectRatio: 4, mac: 1, staticMargin: 0,
  sections: [0, 2].map((yPosition, i) => ({ id: `s${i}`, yPosition, chord: 1, xOffset: 0, twist: 0, dihedral: 0,
    airfoilId: "foil", chordwisePanels: 1, spanwisePanels: 2, chordwiseDistribution: "uniform" as const, spanwiseDistribution: "uniform" as const })) };
const fsi = { id: "fsi", status: "converged" as const, reviewStatus: "current" as const, aircraftSnapshot: aircraft,
  createdAt: "2026-10-16T00:00:00Z", speed: 10, alphaDegrees: 2, deformedMesh: createWingAnalysisMesh(aircraft.sections) };
const before: AnalysisCase = { id: "before", name: "初期検討", scope: "aircraft", method: "VLM", geometryId: aircraft.id,
  speed: 10, alphaStart: 0, alphaEnd: 4, alphaStep: 2, altitude: 0, reynolds: 100000, status: "completed" };
const beforeResult: AnalysisResult = { id: "before-result", caseId: before.id, caseSnapshot: before, clMax: 0.6, cdMin: 0.01, cm0: 0.04, maxLD: 30,
  status: "completed", rows: [0, 4].map((alpha) => ({ caseId: before.id, alpha, cl: 0.2 + alpha * 0.1, cm: 0.04 - alpha * 0.02, cd: 0.01, ld: 20, status: "completed" })) };

describe("FsiStabilityWorkspace", () => {
  it("automatically freezes the displayed FSI result, runs the case and compares an initial result", async () => {
    const user = userEvent.setup(); const saved = vi.fn();
    const run = vi.fn(async ({ analysisCase }: AircraftAnalysisInput) => ({ ...beforeResult, id: "after-result", caseId: analysisCase.id,
      caseSnapshot: analysisCase, rows: beforeResult.rows.map((row) => ({ ...row, caseId: analysisCase.id, crBeta: -0.15, cyBeta: 0.2, cnBeta: 0.08 })) }));
    function Harness() {
      const [cases, setCases] = useState<AnalysisCase[]>([before]);
      const [results, setResults] = useState<AnalysisResult[]>([beforeResult]);
      return <MemoryRouter><JobProvider><FsiStabilityWorkspace aircraft={aircraft} fsiResult={fsi} cases={cases} results={results} polars={[]}
        analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), remove: vi.fn(), save: async (value) => { saved(value); setCases((all) => [...all, value]); return value; } }}
        saveAnalysisResult={(value) => setResults((all) => [...all, value])} analysisRunner={{ run }} /></JobProvider></MemoryRouter>;
    }
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "初期検討を詳細表示" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    expect(screen.queryByRole("combobox", { name: "FSI結果" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "評価形状" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "FSI後確認");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ speed: 10, alphaStart: 0, alphaEnd: 4,
      stabilityShape: expect.objectContaining({ kind: "fsi", resultId: "fsi", wingMesh: fsi.deformedMesh }) }));
    await user.click(screen.getByRole("button", { name: "FSI後確認を再実行" }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(expect.objectContaining({ analysisCase: expect.objectContaining({
      stabilityShape: expect.objectContaining({ resultId: "fsi" }),
    }) }), expect.any(AbortSignal), expect.any(Function)));
    await user.selectOptions(screen.getByRole("combobox", { name: "初期検討結果と比較" }), beforeResult.id);
    expect(screen.getByRole("region", { name: "評価形状別の静安定性比較" }).textContent).toContain("初期検討");
  });

  it.each(["stale", "unconverged", "geometry", "missing"])("blocks new cases when the displayed result is %s", (condition) => {
    const result = condition === "missing" ? undefined : condition === "stale" ? { ...fsi, reviewStatus: "needs-review" as const }
      : condition === "unconverged" ? { ...fsi, status: "max-iterations" as const }
      : { ...fsi, aircraftSnapshot: { ...aircraft, incidence: 1 } };
    render(<MemoryRouter><JobProvider><FsiStabilityWorkspace aircraft={aircraft} fsiResult={result} cases={[]} results={[]} polars={[]}
      analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    expect((screen.getByRole("button", { name: "解析ケースを作成" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps saved frozen cases accessible even without their original FSI result", async () => {
    const user = userEvent.setup();
    const frozen: AnalysisCase = { ...before, id: "saved-frozen", name: "保存済みFSI後評価", stabilityShape: {
      kind: "fsi", resultId: fsi.id, createdAt: fsi.createdAt, speed: fsi.speed, alphaDegrees: fsi.alphaDegrees,
      aircraftSnapshot: aircraft, wingMesh: fsi.deformedMesh,
    } };
    render(<MemoryRouter><JobProvider><FsiStabilityWorkspace aircraft={aircraft} cases={[before, frozen]} results={[]} polars={[]}
      analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "初期検討を詳細表示" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "保存済みFSI後評価を詳細表示" }));
    expect(screen.getByRole("dialog", { name: "解析ケース詳細" }).textContent).toContain("保存済みFSI後評価");
  });
});
