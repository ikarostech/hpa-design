import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AnalysisResult } from "../../analysis/model/types";
import type { StructuralAnalysisResult, StructuralLoadCase } from "../model/types";

export function createLoadCaseFromAerodynamicResult({
  result,
  aircraft,
  density = 1.225,
  pointCount = 41,
  safetyFactor = 1.5,
  alphaDegrees,
}: {
  result: AnalysisResult;
  aircraft: AircraftGeometry;
  density?: number;
  pointCount?: number;
  safetyFactor?: number;
  alphaDegrees?: number;
}): StructuralLoadCase {
  const semiSpan = aircraft.span / 2;
  const speed = result.caseSnapshot?.speed ?? 0;
  if (semiSpan <= 0 || speed <= 0 || aircraft.wingArea <= 0) throw new Error("空力荷重の生成には翼幅、翼面積、解析速度が必要です。");
  const selectedRow = alphaDegrees === undefined
    ? [...result.rows].sort((left, right) => right.cl - left.cl).find((row) => row.spanwise)
    : result.rows.find((row) => Math.abs(row.alpha - alphaDegrees) < 1e-9 && row.spanwise);
  if (selectedRow?.spanwise) {
    return {
      id: `structural-load-${result.id}-${selectedRow.alpha}`,
      name: `${result.caseSnapshot?.name ?? result.caseId} α=${selectedRow.alpha}°`,
      source: "aerodynamic",
      aerodynamicResultId: result.id,
      aerodynamicAlphaDegrees: selectedRow.alpha,
      loadFactor: 1,
      safetyFactor,
      distributedLoads: selectedRow.spanwise.samples.map((sample) => ({
        yPosition: sample.position,
        liftPerLength: sample.values.liftPerLength,
        torquePerLength: sample.values.torqueAboutElasticAxisPerLength,
      })),
      pointLoads: [],
      status: "not-run",
    };
  }

  const count = Math.max(3, Math.round(pointCount));
  const targetHalfLift = 0.5 * density * speed ** 2 * aircraft.wingArea * result.clMax / 2;
  const raw = Array.from({ length: count }, (_, index) => {
    const yPosition = semiSpan * index / (count - 1);
    return { yPosition, shape: Math.sqrt(Math.max(0, 1 - (yPosition / semiSpan) ** 2)) };
  });
  const rawArea = integrate(raw.map((point) => point.yPosition), raw.map((point) => point.shape));
  const scale = targetHalfLift / rawArea;
  return {
    id: `structural-load-${result.id}`,
    name: `${result.caseSnapshot?.name ?? result.caseId} 最大揚力`,
    source: "aerodynamic",
    aerodynamicResultId: result.id,
    loadFactor: 1,
    safetyFactor,
    distributedLoads: raw.map((point) => ({ yPosition: point.yPosition, liftPerLength: point.shape * scale, torquePerLength: 0 })),
    pointLoads: [],
    status: "not-run",
  };
}

export function createStructuralResultCsv(result: StructuralAnalysisResult) {
  const header = "y_m,load_N_per_m,shear_N,bending_Nm,bending_capacity_Nm,bending_reserve_factor,torque_Nm,torque_capacity_Nm,torsion_reserve_factor,deflection_m,rotation_rad,twist_rad,outer_diameter_m,thickness_m,EI_Nm2,GJ_Nm2,linear_mass_kg_per_m,axial_stress_Pa,shear_stress_Pa,reserve_factor,critical_ply,critical_mode";
  const rows = result.points.map((point) => [
    point.yPosition, point.distributedLoad, point.shearForce, point.bendingMoment, point.bendingMomentCapacity ?? "", point.bendingReserveFactor ?? "",
    point.torque, point.torqueCapacity ?? "", point.torsionReserveFactor ?? "",
    point.deflection, point.rotation, point.twist, point.outerDiameter, point.thickness,
    point.ei, point.gj, point.linearMass, point.axialStress, point.shearStress,
    point.minReserveFactor, point.criticalPlyId, point.criticalMode,
  ].map(csvValue).join(","));
  let startPosition = 0;
  const sections = result.designSnapshot.sections.flatMap((section) => {
    const rows = section.plies.map((ply) => [startPosition, section.length, section.outerDiameter, ply.id, ply.materialId, ply.angle, ply.count].map(csvValue).join(","));
    startPosition += section.length;
    return rows;
  });
  const loads = result.loadCaseSnapshot.distributedLoads.map((load) => [load.yPosition, load.liftPerLength, load.torquePerLength].map(csvValue).join(","));
  const materials = (result.materialSnapshots ?? []).map((material) => [material.id, material.name, material.e1, material.e2, material.g12, material.nu12, material.tensileStrength1, material.compressiveStrength1, material.tensileStrength2, material.compressiveStrength2, material.shearStrength12, material.density, material.plyThickness, material.reductionFactor].map(csvValue).join(","));
  const supports = (result.summary.supportReactions ?? []).map((support) => [support.supportId, support.yPosition, support.force].map(csvValue).join(","));
  return `\uFEFF${header}\n${rows.join("\n")}\n\n[tube_sections_and_layup]\nstart_y_m,length_m,outer_diameter_m,ply_id,material_id,angle_deg,count\n${sections.join("\n")}\n\n[distributed_loads]\ny_m,lift_N_per_m,torque_Nm_per_m\n${loads.join("\n")}\n\n[support_reactions]\nsupport_id,y_m,force_N\n${supports.join("\n")}\n\n[materials]\nid,name,E1_Pa,E2_Pa,G12_Pa,nu12,Xt_Pa,Xc_Pa,Yt_Pa,Yc_Pa,S12_Pa,density_kg_per_m3,ply_thickness_m,reduction_factor\n${materials.join("\n")}`;
}

export function createStructuralSummary(result: StructuralAnalysisResult) {
  return `# 構造解析サマリー

- 構造設計: ${result.designSnapshot.name}
- 荷重ケース: ${result.loadCaseSnapshot.name}
- 実行日時: ${result.createdAt}
- パイプ重量: ${result.summary.mass.toFixed(3)} kg（片翼）
- 最大たわみ: ${result.summary.maxDeflection.toFixed(6)} m
- 最大ねじれ: ${result.summary.maxTwist.toFixed(6)} rad
- 最小リザーブファクター: ${result.summary.minReserveFactor.toFixed(3)}
- 支配位置: ${result.summary.governingPosition.toFixed(3)} m
- 支配層: ${result.summary.governingPlyId}
- 支配モード: ${result.summary.governingMode}
- 力の釣り合い誤差: ${result.summary.forceBalanceError.toExponential(3)} N
- モーメントの釣り合い誤差: ${(result.summary.momentBalanceError ?? 0).toExponential(3)} Nm
- 材料スナップショット: ${(result.materialSnapshots ?? []).map((material) => material.name).join("、") || "IDのみ"}

## 解析条件

- SI単位系
- 線形Euler–Bernoulli梁
- 古典積層理論に基づく積層等価剛性
- 最大応力基準
- 円形薄肉カーボンパイプ

## 適用範囲

本結果は一次元線形梁による初期設計値です。局部座屈、断面扁平化、接合部、大たわみ、材料ばらつきは別途確認してください。
`;
}

function integrate(x: readonly number[], values: readonly number[]) {
  let total = 0;
  for (let index = 1; index < x.length; index += 1) total += (values[index - 1] + values[index]) * (x[index] - x[index - 1]) / 2;
  return total;
}

function csvValue(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Infinity";
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
