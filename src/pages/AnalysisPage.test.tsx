import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AnalysisPage } from "./AnalysisPage";
import { JobProvider } from "../shared/jobs/JobProvider";

const aircraft = { id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8, sections: [] };
const cases = [
  { id: "case-1", name: "Cruise", method: "LLT" as const, alphaStart: -2, alphaEnd: 8, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId: "geo-1", status: "not-run" as const },
  { id: "case-2", name: "Climb", method: "VLM" as const, alphaStart: 0, alphaEnd: 12, alphaStep: 2, speed: 18, altitude: 100, reynolds: 280000, geometryId: "geo-2", status: "not-run" as const },
];

describe("AnalysisPage", () => {
  it("updates the visible settings when a different analysis case is selected", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JobProvider><AnalysisPage aircraft={aircraft} cases={cases} results={[]} polarIds={[]} analysisCaseRepository={{ list: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }} saveAnalysisResult={vi.fn()} /></JobProvider></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "解析ケース Climb: VLM, 0° to 12° (2°刻み)" }));

    expect(screen.getByText("geo-2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "解析を実行" })).toBeTruthy();
  });
});
