import { useMemo, useState } from "react";
import type { StaticAeroelasticResult } from "../features/aeroelastic/services/staticAeroelasticSolver";
import type { StabilityFsiShapeOption } from "../features/analysis/model/stabilityShape";
import { stabilityShapeErrors } from "../features/analysis/model/stabilityShape";
import { sameStabilityGeometry } from "../features/analysis/services/stabilityShape";
import { AnalysisWorkspace, type AnalysisPageProps } from "./AnalysisPage";

type FsiResult = Pick<StaticAeroelasticResult, "id" | "status" | "reviewStatus" | "aircraftSnapshot" | "createdAt" | "speed" | "alphaDegrees" | "deformedMesh">;
export type FsiStabilityInputs = Pick<AnalysisPageProps, "cases" | "results" | "analysisCaseRepository" | "saveAnalysisResult" | "analysisRunner">;
interface Props extends FsiStabilityInputs, Pick<AnalysisPageProps, "aircraft" | "polars"> { fsiResult?: FsiResult }

export function FsiStabilityWorkspace({ fsiResult, ...props }: Props) {
  const [comparisonId, setComparisonId] = useState("");
  const shape = useMemo<StabilityFsiShapeOption["shape"] | undefined>(() => fsiResult ? {
    kind: "fsi", resultId: fsiResult.id, createdAt: fsiResult.createdAt, speed: fsiResult.speed, alphaDegrees: fsiResult.alphaDegrees,
    aircraftSnapshot: fsiResult.aircraftSnapshot, wingMesh: fsiResult.deformedMesh,
  } : undefined, [fsiResult]);
  const reason = !fsiResult ? "新規ケースを作成するには、FSIを実行して収束した最新の結果を用意してください。"
    : fsiResult.status !== "converged" ? "未収束のFSI結果では新規ケースを作成できません。"
    : fsiResult.reviewStatus !== "current" ? "FSI結果が要確認です。FSIを再実行してください。"
    : !sameStabilityGeometry(fsiResult.aircraftSnapshot, props.aircraft) ? "現在の機体形状とFSI結果が異なります。FSIを再実行してください。"
    : stabilityShapeErrors(shape, props.aircraft.span / 2).join(" ") || undefined;
  const initialResults = props.results.filter((result) => result.status === "completed" && (result.caseSnapshot?.scope ?? props.cases.find((c) => c.id === result.caseId)?.scope) === "aircraft"
    && (result.caseSnapshot?.stabilityShape ?? props.cases.find((c) => c.id === result.caseId)?.stabilityShape)?.kind !== "fsi");
  const comparison = initialResults.find((r) => r.id === comparisonId);
  return <section aria-label="FSI後の固定形状評価" className="space-y-4">
    <div><h2 className="text-lg font-semibold text-slate-950">FSI後の固定形状評価</h2>
      <p className="mt-1 text-sm text-slate-600">上の連成結果の変形主翼と設定済み尾翼を使います。形状は固定し、迎角・横滑りによる追加変形と動安定性は含みません。</p>
      {fsiResult ? <p className="mt-2 text-sm text-slate-600">引き継ぐFSI条件: {fsiResult.speed} m/s・迎角 {fsiResult.alphaDegrees}° / {fsiResult.createdAt}</p> : null}
      <p className="mt-1 text-xs text-slate-500">新規ケースは表示中の連成結果を引き継ぎます。保存済みケースは取得時の形状を保持します。</p>
    </div>
    {reason ? <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{reason}</p> : null}
    <label className="grid max-w-lg gap-1 text-sm text-slate-700"><span>初期検討結果と比較</span><select className="rounded-md border border-slate-300 px-3 py-2" value={comparison ? comparisonId : ""} onChange={(e) => setComparisonId(e.target.value)}>
      <option value="">比較しない</option>{initialResults.map((result) => <option key={result.id} value={result.id}>{result.caseSnapshot?.name ?? props.cases.find((c) => c.id === result.caseId)?.name ?? result.caseId}</option>)}
    </select></label>
    <AnalysisWorkspace {...props} key={fsiResult ? `${fsiResult.id}/${fsiResult.createdAt}` : "saved"} scope="aircraft" stabilityPhase="post-fsi"
      fixedFsiShape={reason ? undefined : shape} creationDisabledReason={reason} comparisonResults={comparison ? [comparison] : []} />
  </section>;
}
