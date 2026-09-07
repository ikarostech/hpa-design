import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const document = {
  schemaVersion: 4 as const,
  name: "Test aircraft",
  airfoils: [], polars: [], airfoilAnalysisRuns: [], analysisCases: [], analysisResults: [], carbonMaterials: [], structuralDesigns: [], structuralResults: [],
  aircraft: { id: "aircraft-1", span: 4, rootChord: 1, tipChord: 0.5, taperRatio: 0.5, twist: 0, dihedral: 0, sweep: 0, incidence: 0, wingArea: 3, aspectRatio: 5.33, mac: 0.78, staticMargin: 8, sections: [] },
};

describe("DashboardPage", () => {
  it("shows a readable import error and keeps the editing routes available", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><DashboardPage document={document} isDirty={false} onExport={vi.fn()} onImportFile={async () => { throw new Error("JSON schema is invalid"); }} /></MemoryRouter>);

    await user.upload(screen.getByLabelText("設計ファイルを読み込む"), new File(["invalid"], "invalid.json", { type: "application/json" }));

    expect((await screen.findByRole("alert")).textContent).toContain("JSON schema is invalid");
    expect((screen.getByRole("button", { name: "空力設計を開く" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
