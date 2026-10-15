import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftGeometry, carbonMaterials, structuralDesigns } from "../mocks/mockData";
import { FsiPage } from "./FsiPage";
import { JobProvider } from "../shared/jobs/JobProvider";
import { MemoryRouter } from "react-router-dom";

afterEach(cleanup);

describe("FsiPage", () => {
  it("presents FSI as the coupled workspace fed by aerodynamic and structural designs", () => {
    render(<MemoryRouter><JobProvider><FsiPage
      aircraft={aircraftGeometry}
      polars={[]}
      materials={carbonMaterials}
      structuralDesigns={structuralDesigns}
      results={[]}
      onSaveResult={vi.fn()}
      stability={{ cases: [], results: [], analysisCaseRepository: { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }, saveAnalysisResult: vi.fn() }}
    /></JobProvider></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "空力・構造連成（FSI）" })).toBeTruthy();
    expect(screen.getByText(/変形後の主翼形状で空力荷重を再計算/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "空力設計から" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "構造設計から" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FSIで評価" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "空力構造連成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成解析を実行" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "構造設計" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "安定性設計へ" }).getAttribute("href")).toBe("/stability");
    expect(screen.getByRole("heading", { name: "FSI後の固定形状評価" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "解析ケースを作成" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
