import { cleanup, render, screen } from "@testing-library/react";
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

afterEach(cleanup);

describe("StructuralLoadsTab", () => {
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
