import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisPage } from "./AnalysisPage";
import { ResultsPage } from "./ResultsPage";
import { JobProvider } from "../shared/jobs/JobProvider";
import type { StructuralAnalysisResult } from "../features/structures/model/types";
import { JobStatusButton } from "../shared/jobs/JobStatusButton";

vi.mock("../features/airfoils/components/PolarCharts", () => ({
  PolarCharts: ({ series = [] }: { series?: Array<{ id: string; name: string }> }) => <div data-testid="polar-charts">{series.map((item) => <span key={item.id}>{item.name}</span>)}</div>,
}));

vi.mock("./components/IntegratedSpanwiseCharts", () => ({
  IntegratedSpanwiseCharts: ({ structuralResult, aerodynamicResult, alphaDegrees }: { structuralResult: StructuralAnalysisResult; aerodynamicResult?: { id: string }; alphaDegrees?: number }) => <div role="img" aria-label="空力・構造の翼幅方向グラフ">{aerodynamicResult?.id}/{alphaDegrees}/{structuralResult.id}</div>,
}));

const spanwise = (alphaDegrees: number) => ({
  axis: { key: "semi-span" as const, unit: "m" as const, label: "半翼幅" },
  reference: { side: "right" as const, origin: "centerline" as const, alphaDegrees, speed: 20, density: 1.225, elasticAxisChordFraction: 0.35 },
  samples: [],
});

const aircraft = { id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8, sections: [] };
const cases = [
  { id: "case-1", name: "Cruise", method: "LLT" as const, alphaStart: -2, alphaEnd: 8, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId: "geo-1", status: "not-run" as const },
  { id: "case-2", name: "Climb", method: "VLM" as const, alphaStart: 0, alphaEnd: 12, alphaStep: 2, speed: 18, altitude: 100, reynolds: 280000, geometryId: "geo-2", status: "not-run" as const },
];
const results = [{
  id: "result-1",
  caseId: "case-1",
  clMax: 0.8,
  cdMin: 0.02,
  maxLD: 40,
  cm0: -0.04,
  status: "completed" as const,
  rows: [
    { caseId: "case-1", alpha: 0, cl: 0.2, cd: 0.02, cm: -0.04, ld: 10, status: "completed" as const, spanwise: spanwise(0) },
    { caseId: "case-1", alpha: 4, cl: 0.8, cd: 0.03, cm: -0.05, ld: 26.67, status: "completed" as const, spanwise: spanwise(4) },
  ],
}, {
  id: "result-2",
  caseId: "case-2",
  clMax: 1,
  cdMin: 0.025,
  maxLD: 38,
  cm0: -0.03,
  status: "completed" as const,
  rows: [
    { caseId: "case-2", alpha: 0, cl: 0.3, cd: 0.025, cm: -0.03, ld: 12, status: "completed" as const },
    { caseId: "case-2", alpha: 4, cl: 1, cd: 0.035, cm: -0.04, ld: 28.57, status: "completed" as const },
  ],
}];
const structuralResults = [{
  id: "structural-result-1",
  createdAt: "2026-08-19T00:00:00.000Z",
  status: "completed",
  designSnapshot: { id: "spar-1", name: "Main spar", sections: [], loadCases: [] },
  loadCaseSnapshot: { id: "load-1", name: "Cruise load", source: "aerodynamic", aerodynamicResultId: "result-1", aerodynamicAlphaDegrees: 4, loadFactor: 1, safetyFactor: 1.5, distributedLoads: [], pointLoads: [], status: "completed" },
  summary: { minReserveFactor: 2.5, governingPosition: 0.4, governingMode: "繊維圧縮", maxDeflection: 0.01, maxTwist: 0.02 },
}] as unknown as StructuralAnalysisResult[];

afterEach(cleanup);

describe("AnalysisPage", () => {
  it("keeps FSI cases out of initial stability design and offers only rigid/manual shapes", async () => {
    const user = userEvent.setup();
    const post = { ...cases[1], name: "After FSI", scope: "aircraft" as const, stabilityShape: { kind: "fsi" as const,
      resultId: "fsi", createdAt: "2026-10-16T00:00:00Z", speed: 18, alphaDegrees: 2, aircraftSnapshot: aircraft,
      wingMesh: { nodes: [], panels: [], strips: [] } } };
    render(<MemoryRouter><JobProvider><AnalysisPage scope="aircraft" stabilityPhase="pre-fsi" aircraft={aircraft} cases={[post]} results={[]} polars={[]}
      analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "After FSIを詳細表示" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    expect(screen.queryByRole("option", { name: "FSI後評価（固定形状）" })).toBeNull();
    expect(screen.getByRole("option", { name: "簡易評価（仮のたわみ）" })).toBeTruthy();
  });
  it("saves a manual stability shape with its case", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<MemoryRouter><JobProvider><AnalysisPage scope="aircraft" aircraft={aircraft} cases={[]} results={[]} polars={[]}
      analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save, remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "Quick stability");
    await user.selectOptions(screen.getByRole("combobox", { name: "評価形状" }), "manual");
    await user.clear(screen.getByRole("spinbutton", { name: "点2 たわみ (m)" }));
    await user.type(screen.getByRole("spinbutton", { name: "点2 たわみ (m)" }), "0.3");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ stabilityShape: {
      kind: "manual", elasticAxisChordFraction: 0.35,
      points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.3, twist: 0 }],
    } })));
  });
  it("separates wing and aircraft cases and defaults new stability cases to VLM", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const wholeCase = { ...cases[1], scope: "aircraft" as const };
    render(<MemoryRouter initialEntries={["/aerodynamics/stability"]}><JobProvider><AnalysisPage scope="aircraft" aircraft={aircraft} cases={[cases[0], wholeCase]} results={results} polars={[]}
      analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save, remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "安定性設計" })).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "空力設計" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cruiseを詳細表示" })).toBeNull();
    expect(screen.getByRole("button", { name: "Climbを詳細表示" })).toBeTruthy();
    expect(screen.queryByTestId("polar-charts")).toBeNull();
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    const editor = screen.getByRole("dialog", { name: "解析ケースを新規作成" });
    expect((within(editor).getByRole("combobox", { name: "解析対象" }) as HTMLSelectElement).value).toBe("aircraft");
    expect((within(editor).getByRole("combobox", { name: "解析手法" }) as HTMLSelectElement).value).toBe("VLM");
    await user.type(within(editor).getByRole("textbox", { name: "ケース名" }), "Stability");
    await user.click(within(editor).getByRole("button", { name: "解析ケースを保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ scope: "aircraft", method: "VLM" })));
  });
  it("shows whole-aircraft trim and stability without a per-surface contribution table", async () => {
    const user = userEvent.setup();
    const analysisCase = { ...cases[1], scope: "aircraft" as const, beta: 3 };
    const coupledResult = { ...results[1], caseId: analysisCase.id, caseSnapshot: analysisCase, aircraftSnapshot: aircraft,
      rows: [{ ...results[1].rows[0], cl: 0.2, cm: 0.04, cy: 0.01, cr: 0.02, cn: 0.03, cdi: 0.025, cgX: 0.4, cnBeta: 0.08, crBeta: -0.1, cyBeta: 0.2,
        surfaceLoads: [{ surfaceId: aircraft.id, cl: 0.2, cy: 0.01, cm: 0.04, cr: 0.02, cn: 0.03 }] },
      { ...results[1].rows[1], cl: 0.6, cm: -0.04, cgX: 0.4, cnBeta: 0.1, crBeta: -0.2, cyBeta: 0.4 }] };
    function Harness() {
      const [saved, setSaved] = useState<typeof coupledResult[]>([]);
      return <MemoryRouter><JobProvider><AnalysisPage scope="aircraft" aircraft={aircraft} cases={[analysisCase]} results={saved} polars={[]}
        analysisRunner={{ run: async () => coupledResult }}
        analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }}
        saveAnalysisResult={(value) => setSaved([value as typeof coupledResult])} /></JobProvider></MemoryRouter>;
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Climbを詳細表示" }));
    await user.click(screen.getByRole("button", { name: "Climbを解析" }));
    expect(await screen.findByText(/全翼面VLMは非粘性/)).toBeTruthy();
    expect(screen.queryByText(/翼面別寄与/)).toBeNull();
    expect(screen.getByText(/迎角別の静安定性/)).toBeTruthy();
    expect(screen.queryByTestId("polar-charts")).toBeNull();
    expect(screen.queryByText("トリム時 CL")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "CL" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "CDi" })).toBeNull();
    expect(screen.getByRole("figure", { name: "縦安定・トリム Cm - α" })).toBeTruthy();
    expect(screen.getByRole("figure", { name: "上反角効果 Crβ - α" })).toBeTruthy();
    expect(screen.getByRole("figure", { name: "方向静安定 Cnβ - α" })).toBeTruthy();
    expect(screen.getByText(/トリム迎角/)).toBeTruthy();
    expect(screen.getByText("2.00°")).toBeTruthy();
    expect(screen.getByText("静安定余裕 (−dCm/dCL)")).toBeTruthy();
    expect(screen.getByText("20.0%")).toBeTruthy();
    expect(screen.getByText("上反角効果 Crβ")).toBeTruthy();
    expect(screen.getByText("−0.150 /rad")).toBeTruthy();
    expect(screen.getByText("横力微係数 CYβ")).toBeTruthy();
    expect(screen.getByText(/動安定性は未評価/)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Crβ (/rad)" })).toBeTruthy();
  });
  it("creates a whole-aircraft VLM case with a sideslip input", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(<MemoryRouter><JobProvider><AnalysisPage scope="aircraft" aircraft={aircraft} cases={[]} results={[]} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save, remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    const editor = screen.getByRole("dialog", { name: "解析ケースを新規作成" });
    await user.type(within(editor).getByRole("textbox", { name: "ケース名" }), "Coupled VLM");
    expect((within(editor).getByRole("combobox", { name: "解析対象" }) as HTMLSelectElement).disabled).toBe(true);
    await user.selectOptions(within(editor).getByRole("combobox", { name: "解析手法" }), "VLM");
    await user.clear(within(editor).getByRole("spinbutton", { name: "横滑り角 β (°)" }));
    await user.type(within(editor).getByRole("spinbutton", { name: "横滑り角 β (°)" }), "3");
    await user.clear(within(editor).getByRole("spinbutton", { name: "重心位置 X (m)" }));
    await user.type(within(editor).getByRole("spinbutton", { name: "重心位置 X (m)" }), "0.4");
    await user.clear(within(editor).getByRole("spinbutton", { name: "重心位置 Z (m)" }));
    await user.type(within(editor).getByRole("spinbutton", { name: "重心位置 Z (m)" }), "-0.2");
    await user.click(within(editor).getByRole("button", { name: "解析ケースを保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ scope: "aircraft", beta: 3, cgX: 0.4, cgZ: -0.2, method: "VLM" })));
  });
  it("presents aerodynamic analysis cases in the standard management layout", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "主翼解析" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "解析ケース" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "操作" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Climbを詳細表示" }));

    const detail = screen.getByRole("dialog", { name: "解析ケース詳細" });
    expect(detail.textContent).toContain("geo-2");
    expect(screen.getByRole("button", { name: "Climbを解析" })).toBeTruthy();
  });

  it("opens creation in the standard inspector drawer", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));

    expect(screen.getByRole("dialog", { name: "解析ケースを新規作成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "解析ケースを保存" })).toBeTruthy();
  });

  it("presents rigid-wing analysis as a tab of aerodynamic design", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/analysis"]}><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "主翼解析" })).toBeTruthy();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["翼型", "主翼設計", "主翼解析"]);
    expect(screen.getByRole("tab", { name: "主翼解析" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tab", { name: "空力構造連成" })).toBeNull();
  });

  it("keeps an aerodynamic analysis registered while its worker result is pending", async () => {
    const user = userEvent.setup();
    const saveResult = vi.fn();
    let finish!: (result: (typeof results)[number]) => void;
    let reportProgress!: (progress: { completed: number; total: number; message?: string }) => void;
    const pending = new Promise<(typeof results)[number]>((resolve) => { finish = resolve; });
    const analysisRunner = { run: vi.fn((_input, _signal, onProgress) => { reportProgress = onProgress; return pending; }) };
    render(<MemoryRouter><JobProvider><JobStatusButton /><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polars={[]} analysisRunner={analysisRunner} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={saveResult} /></JobProvider></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "Climbを詳細表示" }));
    await user.click(screen.getByRole("button", { name: "Climbを解析" }));

    expect(screen.getByRole("button", { name: "解析中 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "解析をキャンセル" })).toBeTruthy();
    reportProgress({ completed: 2, total: 7, message: "VLM: 2°" });
    await waitFor(() => expect(screen.getByText(/VLM: 2°/)).toBeTruthy());
    expect(saveResult).not.toHaveBeenCalled();

    finish(results[1]);
    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(results[1]));
  });

  it("shows the selected case result charts instead of the wing layout", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={results} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "選択ケースの解析結果" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "主翼形状プレビュー" })).toBeNull();
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.indexOf("選択ケースの解析結果")).toBeLessThan(headings.indexOf("解析ケース"));
    expect(screen.queryByRole("columnheader", { name: "主結果" })).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    const charts = screen.getByTestId("polar-charts");
    expect(within(charts).getByText("Cruise")).toBeTruthy();
    expect(within(charts).queryByText("Climb")).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Climbをグラフに表示" }));
    expect(within(charts).getByText("Climb")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cruiseを詳細表示" }));
    expect(screen.queryByRole("img", { name: "主翼形状プレビュー" })).toBeNull();
  });

  it("combines a linked aerodynamic result and structural result on the dedicated results page", () => {
    render(<ResultsPage cases={cases} results={results} structuralResults={structuralResults} />);

    expect(screen.getByRole("heading", { name: "結果" })).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("heading", { name: "空力・構造 統合結果" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "空力運用点" }) as HTMLSelectElement).value).toBe("4");
    expect(screen.getByText("空力運用点と関連付け済み")).toBeTruthy();
    expect(screen.getByText("最小安全率")).toBeTruthy();
    expect(screen.queryByText(/Excel曲げ/)).toBeNull();
    expect(screen.getByRole("combobox", { name: "構造解析結果" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "空力・構造の翼幅方向グラフ" }).textContent).toBe("result-1/4/structural-result-1");
  });
});
