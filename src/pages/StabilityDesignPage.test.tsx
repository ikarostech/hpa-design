import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobProvider } from "../shared/jobs/JobProvider";
import { StabilityDesignPage } from "./StabilityDesignPage";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

const aircraft = { id: "aircraft", span: 4, rootChord: 1, tipChord: 1, taperRatio: 1, twist: 0, dihedral: 0,
  sweep: 0, incidence: 0, wingArea: 4, aspectRatio: 4, mac: 1, staticMargin: 0,
  sections: [0, 2].map((yPosition, i) => ({ id: `s${i}`, yPosition, chord: 1, xOffset: 0, twist: 0, dihedral: 0,
    airfoilId: "foil", chordwisePanels: 1, spanwisePanels: 2, chordwiseDistribution: "uniform" as const, spanwiseDistribution: "uniform" as const })) };
const props = { aircraft, cases: [], results: [], polars: [],
  analysisCaseRepository: { list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }, saveAnalysisResult: vi.fn() };

describe("StabilityDesignPage", () => {
  it("provides rigid stability before structural sizing and directs deformation evaluation to FSI", () => {
    render(<MemoryRouter><JobProvider><StabilityDesignPage {...props} /></JobProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "安定性設計" })).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "空力設計" })).toBeNull();
    expect(screen.getByText(/構造が未確定でも/)).toBeTruthy();
    expect(screen.getByText(/FSI前の簡易評価/)).toBeTruthy();
    expect(screen.getByText(/FSI後の評価はFSIページへ/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "構造設計を開く" }).getAttribute("href")).toBe("/structures");
    expect(screen.getByRole("link", { name: "FSIで変形を確認" }).getAttribute("href")).toBe("/fsi");
  });

  it("offers rigid and manual initial design without an FSI shape selector", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    render(<MemoryRouter><JobProvider><StabilityDesignPage {...props} analysisCaseRepository={{ ...props.analysisCaseRepository, save }} /></JobProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: "解析ケースを作成" }));
    await user.type(screen.getByRole("textbox", { name: "ケース名" }), "Initial design");
    expect(screen.queryByRole("option", { name: /FSI/ })).toBeNull();
    await user.selectOptions(screen.getByRole("combobox", { name: "評価形状" }), "manual");
    await user.click(screen.getByRole("button", { name: "解析ケースを保存" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ stabilityShape: expect.objectContaining({ kind: "manual" }) }));
  });
});
