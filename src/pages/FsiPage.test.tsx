import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { aircraftGeometry, carbonMaterials, structuralDesigns } from "../mocks/mockData";
import { FsiPage } from "./FsiPage";
import { JobProvider } from "../shared/jobs/JobProvider";

afterEach(cleanup);

describe("FsiPage", () => {
  it("presents FSI as the coupled workspace fed by aerodynamic and structural designs", () => {
    render(<JobProvider><FsiPage
      aircraft={aircraftGeometry}
      polars={[]}
      materials={carbonMaterials}
      structuralDesigns={structuralDesigns}
      results={[]}
      onSaveResult={vi.fn()}
    /></JobProvider>);

    expect(screen.getByRole("heading", { name: "空力・構造連成（FSI）" })).toBeTruthy();
    expect(screen.getByText(/変形後の主翼形状で空力荷重を再計算/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "空力設計から" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "構造設計から" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "FSIで評価" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "空力構造連成" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成解析を実行" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "構造設計" })).toBeTruthy();
  });
});
