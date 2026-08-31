import type { StaticAeroelasticResult } from "./staticAeroelasticSolver";

export function createAeroelasticResultCsv(result: StaticAeroelasticResult) {
  const spanLoads = result.spanLoads.map((point) => [
    point.yPosition, point.width, point.circulation, point.liftPerLength, point.dragPerLength, point.torquePerLength,
  ].map(csvValue).join(","));
  const iterations = result.iterations.map((iteration) => [
    iteration.iteration, iteration.alphaDegrees, iteration.cl, iteration.cdi, iteration.totalLift,
    iteration.maxDeflection, iteration.maxTwist, iteration.displacementResidual,
    iteration.loadResidual ?? "", iteration.liftResidual,
  ].map(csvValue).join(","));
  const structural = result.structuralResult.points.map((point) => [
    point.yPosition, point.distributedLoad, point.shearForce, point.bendingMoment, point.torque,
    point.deflection, point.rotation, point.twist, point.minReserveFactor,
  ].map(csvValue).join(","));
  return `\uFEFF[result]\nkey,value\nstatus,${csvValue(result.status)}\nreview_status,${csvValue(result.reviewStatus)}\nalpha_deg,${result.alphaDegrees}\nCL,${result.cl}\nCDi,${result.cdi}\nCm,${result.cm}\ntotal_lift_N,${result.totalLift}\nspeed_m_per_s,${result.speed}\ndensity_kg_per_m3,${result.density}\nelastic_axis_x_over_c,${result.elasticAxisChordFraction}\n\n[span_loads]\ny_m,width_m,circulation_m2_per_s,lift_N_per_m,drag_N_per_m,torque_Nm_per_m\n${spanLoads.join("\n")}\n\n[iterations]\niteration,alpha_deg,CL,CDi,total_lift_N,max_deflection_m,max_twist_rad,displacement_residual,load_residual,lift_residual\n${iterations.join("\n")}\n\n[structural_results]\ny_m,load_N_per_m,shear_N,bending_Nm,torque_Nm,deflection_m,rotation_rad,twist_rad,reserve_factor\n${structural.join("\n")}`;
}

export function createAeroelasticResultSummary(result: StaticAeroelasticResult) {
  const condition = result.condition.mode === "fixed-alpha"
    ? `固定迎角 ${result.condition.alphaDegrees}°`
    : `目標揚力 ${result.condition.targetLift} N`;
  const warnings = result.warnings.length ? result.warnings.map((warning) => `- ${warning}`).join("\n") : "- なし";
  return `# 空力構造連成解析サマリー

- 解析ID: ${result.id}
- 実行日時: ${result.createdAt}
- 収束状態: ${statusLabel(result.status)}
- 確認状態: ${result.reviewStatus === "current" ? "最新" : "要確認"}
- 飛行条件: ${condition}
- 収束迎角: ${result.alphaDegrees}°
- CL / CDi / Cm: ${result.cl} / ${result.cdi} / ${result.cm}
- 総揚力: ${result.totalLift} N
- 最大たわみ: ${result.structuralResult.summary.maxDeflection} m
- 最大ねじれ: ${result.structuralResult.summary.maxTwist} rad
- 最小安全率: ${result.structuralResult.summary.minReserveFactor}
- 反復回数: ${result.iterations.length} / ${result.settings.maxIterations}

## 警告

${warnings}

## 解析手法

- 定常VLM
- 線形Euler–Bernoulli梁
- 空力荷重と弾性変形の不足緩和付き固定点反復
- 緩和係数: ${result.settings.relaxationFactor}
- 変位残差許容値: ${result.settings.displacementTolerance}
- 荷重残差許容値: ${result.settings.loadTolerance}

## 適用範囲

低速・非圧縮・付着流と小変形を仮定した初期設計解析です。剥離、局部座屈、断面扁平化、接合部、突風、フラッターは別途確認してください。
`;
}

function statusLabel(status: StaticAeroelasticResult["status"]) {
  if (status === "converged") return "収束";
  if (status === "max-iterations") return "最大反復到達";
  return "発散";
}

function csvValue(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
