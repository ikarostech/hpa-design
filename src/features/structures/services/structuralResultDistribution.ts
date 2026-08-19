import type { OneDimensionalDistribution } from "../../../shared/model";
import type { StructuralAnalysisResult } from "../model/types";

export interface StructuralSpanValues {
  distributedLift: number;
  shearForce: number;
  bendingMoment: number;
  bendingMomentCapacity: number | null;
  bendingReserveFactor: number | null;
  torque: number;
  torqueCapacity: number | null;
  torsionReserveFactor: number | null;
  bendingStiffness: number;
  torsionalStiffness: number;
  outerDiameter: number;
  wallThickness: number;
  linearMass: number;
  deflection: number;
  rotation: number;
  twist: number;
  axialStress: number;
  shearStress: number;
  combinedReserveFactor: number;
}

export function toStructuralSpanDistribution(result: StructuralAnalysisResult): OneDimensionalDistribution<StructuralSpanValues> {
  return {
    axis: { key: "semi-span", unit: "m", label: "半翼幅" },
    samples: result.points.map((point) => ({
      position: point.yPosition,
      values: {
        distributedLift: point.distributedLoad,
        shearForce: point.shearForce,
        bendingMoment: point.bendingMoment,
        bendingMomentCapacity: finiteOrNull(point.bendingMomentCapacity),
        bendingReserveFactor: finiteOrNull(point.bendingReserveFactor),
        torque: point.torque,
        torqueCapacity: finiteOrNull(point.torqueCapacity),
        torsionReserveFactor: finiteOrNull(point.torsionReserveFactor),
        bendingStiffness: point.ei,
        torsionalStiffness: point.gj,
        outerDiameter: point.outerDiameter,
        wallThickness: point.thickness,
        linearMass: point.linearMass,
        deflection: point.deflection,
        rotation: point.rotation,
        twist: point.twist,
        axialStress: point.axialStress,
        shearStress: point.shearStress,
        combinedReserveFactor: point.minReserveFactor,
      },
    })),
  };
}

function finiteOrNull(value: number | undefined) {
  return Number.isFinite(value) ? value! : null;
}
