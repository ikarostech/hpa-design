import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InspectorController } from "../../../shared/model";
import type { CarbonMaterial, StructuralTubeSection } from "../model/types";
import { TubeSectionDetailDrawer } from "./TubeSectionDetailDrawer";

const material: CarbonMaterial = {
  id: "carbon", name: "Carbon", e1: 120e9, e2: 8e9, g12: 4e9, nu12: 0.3,
  tensileStrength1: 1200e6, compressiveStrength1: 700e6, tensileStrength2: 40e6,
  compressiveStrength2: 120e6, shearStrength12: 60e6, density: 1550,
  plyThickness: 0.000125, reductionFactor: 0.8,
};
const section: StructuralTubeSection = {
  id: "section", length: 1, outerDiameter: 0.1,
  plies: [{ id: "cap", materialId: material.id, angle: 0, count: 1, partialAngle: 45, partialWidth: 0.08 }],
};
const inspector: InspectorController<string> = {
  state: { open: true, mode: "detail", targetId: section.id },
  openDetail: vi.fn(), openCreate: vi.fn(), openEdit: vi.fn(), close: vi.fn(),
};

describe("TubeSectionDetailDrawer", () => {
  it("edits upper/lower partial-ply angle and width", () => {
    const onChange = vi.fn();
    render(<TubeSectionDetailDrawer section={section} start={0} end={1} materials={[material]} inspector={inspector} onChange={onChange} />);

    expect((screen.getByLabelText("capの上下部分積層角度") as HTMLInputElement).value).toBe("45");
    expect((screen.getByLabelText("capの上下幅") as HTMLInputElement).value).toBe("80.0");
    fireEvent.change(screen.getByLabelText("capの上下部分積層角度"), { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ plies: [expect.objectContaining({ partialAngle: 30 })] }));
  });
});
