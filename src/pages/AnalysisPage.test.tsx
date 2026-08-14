import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisPage } from "./AnalysisPage";
import { JobProvider } from "../shared/jobs/JobProvider";

vi.mock("../features/airfoils/components/PolarCharts", () => ({
  PolarCharts: ({ series = [] }: { series?: Array<{ id: string; name: string }> }) => <div data-testid="polar-charts">{series.map((item) => <span key={item.id}>{item.name}</span>)}</div>,
}));

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
    { caseId: "case-1", alpha: 0, cl: 0.2, cd: 0.02, cm: -0.04, ld: 10, status: "completed" as const },
    { caseId: "case-1", alpha: 4, cl: 0.8, cd: 0.03, cm: -0.05, ld: 26.67, status: "completed" as const },
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

afterEach(cleanup);

describe("AnalysisPage", () => {
  it("presents aerodynamic analysis cases in the standard management layout", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polars={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "空力解析" })).toBeTruthy();
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
});
