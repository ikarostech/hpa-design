import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CarbonMaterial, StructuralDesign } from "../model/types";
import { StructuralDesignPropertiesChart } from "./StructuralDesignPropertiesChart";

const material: CarbonMaterial = {
  id: "material-1",
  name: "設計材",
  e1: 70e9,
  e2: 70e9,
  g12: 26.315789e9,
  nu12: 0.33,
  tensileStrength1: 600e6,
  compressiveStrength1: 500e6,
  tensileStrength2: 600e6,
  compressiveStrength2: 500e6,
  shearStrength12: 250e6,
  density: 1600,
  plyThickness: 0.001,
  reductionFactor: 1,
};

const design: StructuralDesign = {
  id: "design-1",
  name: "主桁",
  sections: [{ id: "root", length: 1, outerDiameter: 0.1, plies: [{ id: "ply-1", materialId: material.id, angle: 0, count: 4 }] }],
  loadCases: [],
};

afterEach(cleanup);

describe("StructuralDesignPropertiesChart", () => {
  it("shows bending strength, buckling modes, and stiffness from the current pipe design", () => {
    render(<StructuralDesignPropertiesChart design={design} materials={[material]} selectedSectionId="root" />);

    const strengthPanel = screen.getByRole("region", { name: "曲げ強度・破壊モード" });
    const stiffnessPanel = screen.getByRole("region", { name: "曲げ剛性" });
    expect(within(strengthPanel).getByRole("img", { name: "パイプ設計の曲げ強度と破壊モード" })).toBeTruthy();
    expect(within(stiffnessPanel).getByRole("img", { name: "パイプ設計の曲げ剛性" })).toBeTruthy();
    for (const label of ["初期層破壊曲げ強度（Hashin）", "局部座屈強度", "Brazier扁平化強度"]) {
      expect(within(strengthPanel).getByText(label)).toBeTruthy();
    }
    expect(within(stiffnessPanel).getByText("曲げ剛性 EI")).toBeTruthy();
    expect(within(strengthPanel).queryByText("曲げ剛性 EI")).toBeNull();
    expect(screen.queryByLabelText("最小曲げ剛性")).toBeNull();
    expect(screen.getByLabelText("最小支配曲げ強度").textContent).toContain("MPa");
    const failureSummary = screen.getByRole("region", { name: "選択区間の初期層破壊" });
    expect(failureSummary.textContent).toContain("公称曲げ強度");
    expect(failureSummary.textContent).toContain("繊維圧縮");
    expect(failureSummary.textContent).toContain("ply-1");
  });

  it("keeps the separate stiffness chart when the pipe design changes", () => {
    const { rerender } = render(<StructuralDesignPropertiesChart design={design} materials={[material]} />);

    rerender(<StructuralDesignPropertiesChart design={{
      ...design,
      sections: design.sections.map((section) => ({ ...section, outerDiameter: 0.12 })),
    }} materials={[material]} />);

    expect(screen.getByRole("img", { name: "パイプ設計の曲げ剛性" })).toBeTruthy();
  });

  it("keeps the design editor usable while a numeric input is temporarily invalid", () => {
    render(<StructuralDesignPropertiesChart design={{
      ...design,
      sections: design.sections.map((section) => ({ ...section, outerDiameter: 0 })),
    }} materials={[material]} />);

    expect(screen.getByRole("status").textContent).toContain("グラフを表示できません");
  });
});
