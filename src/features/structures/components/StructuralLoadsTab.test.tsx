import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "../../analysis/model/types";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { StructuralDesign } from "../model/types";
import { StructuralLoadsTab } from "./StructuralLoadsTab";

const spanwise = (alphaDegrees: number, liftPerLength: number) => ({
  axis: { key: "semi-span" as const, unit: "m" as const },
  reference: { side: "right" as const, origin: "centerline" as const, alphaDegrees, speed: 20, density: 1.225, elasticAxisChordFraction: 0.35 },
  samples: [{ position: 0.5, values: { stationWidth: 1, chord: 1, circulation: 1, localLiftCoefficient: 0.5, liftPerLength, inducedDragPerLength: 2, profileDragPerLength: 1, dragPerLength: 3, pitchingMomentPerLength: -1, torqueAboutElasticAxisPerLength: 4 } }],
});

const aerodynamicResult = {
  id: "aero-1", caseId: "case-1", clMax: 0.8, cdMin: 0.02, maxLD: 30, cm0: -0.04, status: "completed" as const,
  caseSnapshot: { id: "case-1", name: "Cruise", method: "VLM" as const, alphaStart: 0, alphaEnd: 4, alphaStep: 4, speed: 20, altitude: 0, reynolds: 300000, geometryId: "wing", status: "completed" as const },
  rows: [
    { caseId: "case-1", alpha: 0, cl: 0.2, cd: 0.02, cm: -0.04, ld: 10, status: "completed" as const, spanwise: spanwise(0, 40) },
    { caseId: "case-1", alpha: 4, cl: 0.8, cd: 0.03, cm: -0.05, ld: 26, status: "completed" as const, spanwise: spanwise(4, 120) },
  ],
} satisfies AnalysisResult;

const loadDesign = {
  id: "spar",
  name: "Spar",
  sections: [],
  loadCases: [
    {
      id: "elliptical",
      name: "楕円分布",
      source: "elliptical" as const,
      loadFactor: 1,
      safetyFactor: 1.5,
      distributedLoads: [
        { yPosition: 0, liftPerLength: 100, torquePerLength: 0 },
        { yPosition: 1, liftPerLength: 0, torquePerLength: 0 },
      ],
      pointLoads: [],
      status: "not-run" as const,
    },
    {
      id: "root-biased",
      name: "翼根寄せ",
      source: "manual" as const,
      loadFactor: 1,
      safetyFactor: 1.5,
      distributedLoads: [
        { yPosition: 0, liftPerLength: 120, torquePerLength: 0 },
        { yPosition: 1, liftPerLength: 0, torquePerLength: 0 },
      ],
      pointLoads: [{ id: "tip-load", yPosition: 1, force: 10, torque: 0 }],
      status: "needs-review" as const,
    },
  ],
} satisfies StructuralDesign;

afterEach(cleanup);

describe("StructuralLoadsTab", () => {
  it("shows the load-point comparison graph before the structural load cases", () => {
    render(<StructuralLoadsTab
      design={loadDesign}
      aircraft={{ id: "wing", span: 2, wingArea: 2 } as AircraftGeometry}
      aerodynamicResults={[]}
      onSaveDesign={vi.fn()}
      onRun={vi.fn()}
    />);

    const graph = screen.getByRole("region", { name: "荷重点グラフ" });
    const cases = screen.getByRole("region", { name: "構造荷重ケース" });
    expect(graph.compareDocumentPosition(cases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses load-case checkboxes to show and hide graph series", async () => {
    const user = userEvent.setup();
    render(<StructuralLoadsTab
      design={loadDesign}
      aircraft={{ id: "wing", span: 2, wingArea: 2 } as AircraftGeometry}
      aerodynamicResults={[]}
      onSaveDesign={vi.fn()}
      onRun={vi.fn()}
    />);

    const graph = screen.getByRole("region", { name: "荷重点グラフ" });
    expect(within(graph).getByText("楕円分布")).toBeTruthy();
    expect(within(graph).getByText("翼根寄せ")).toBeTruthy();

    await user.click(screen.getByRole("checkbox", { name: "翼根寄せをグラフに表示" }));

    expect(within(graph).queryByText("翼根寄せ")).toBeNull();
    expect(within(graph).getByText("楕円分布")).toBeTruthy();
  });

  it("edits load points from the load-case detail drawer", async () => {
    const user = userEvent.setup();
    const onSaveDesign = vi.fn();
    render(<StructuralLoadsTab
      design={loadDesign}
      aircraft={{ id: "wing", span: 2, wingArea: 2 } as AircraftGeometry}
      aerodynamicResults={[]}
      onSaveDesign={onSaveDesign}
      onRun={vi.fn()}
    />);

    expect(screen.queryByRole("spinbutton", { name: "荷重点1の揚力" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "翼根寄せを詳細表示" }));
    expect(screen.getByRole("dialog", { name: "構造荷重ケース詳細" })).toBeTruthy();

    fireEvent.change(screen.getByRole("spinbutton", { name: "荷重点1の揚力" }), { target: { value: "135" } });

    expect(onSaveDesign).toHaveBeenLastCalledWith(expect.objectContaining({
      loadCases: expect.arrayContaining([expect.objectContaining({
        id: "root-biased",
        distributedLoads: expect.arrayContaining([expect.objectContaining({ liftPerLength: 135 })]),
      })]),
    }));
  });

  it("creates the initial elliptical baseline from the assumed gross mass", async () => {
    const user = userEvent.setup();
    const onSaveDesign = vi.fn();
    render(<StructuralLoadsTab
      design={{ id: "spar", name: "Spar", sections: [], loadCases: [] } satisfies StructuralDesign}
      aircraft={{ id: "wing", span: 2, wingArea: 2 } as AircraftGeometry}
      grossMass={100}
      aerodynamicResults={[]}
      onSaveDesign={onSaveDesign}
      onRun={vi.fn()}
    />);

    await user.click(screen.getByRole("button", { name: "想定重量から楕円分布を作成" }));

    expect(onSaveDesign.mock.calls[0][0].loadCases[0]).toMatchObject({ source: "elliptical", name: "想定重量 100 kg（楕円分布）" });
  });

  it("creates a structural load case from the selected aerodynamic operating point", async () => {
    const user = userEvent.setup();
    const onSaveDesign = vi.fn();
    render(<StructuralLoadsTab
      design={{ id: "spar", name: "Spar", sections: [], loadCases: [] } satisfies StructuralDesign}
      aircraft={{ id: "wing", span: 2, wingArea: 2 } as AircraftGeometry}
      aerodynamicResults={[aerodynamicResult]}
      onSaveDesign={onSaveDesign}
      onRun={vi.fn()}
    />);

    await user.selectOptions(screen.getByRole("combobox", { name: "空力運用点" }), "0");
    await user.click(screen.getByRole("button", { name: "空力結果から作成" }));

    expect(onSaveDesign.mock.calls[0][0].loadCases[0]).toMatchObject({ aerodynamicResultId: "aero-1", aerodynamicAlphaDegrees: 0, distributedLoads: [{ liftPerLength: 40 }] });
  });
});
