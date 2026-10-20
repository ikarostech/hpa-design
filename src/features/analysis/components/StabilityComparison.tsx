import type { AnalysisResult } from "../model/types";
import { stabilityShapeLabel } from "../model/stabilityShape";
import { summarizeAircraftStability } from "../model/aircraftStability";

export function StabilityComparison({ results }: { results: readonly AnalysisResult[] }) {
  const format = (value: number | null | undefined, digits = 3) => value == null ? "未算出" : value.toFixed(digits);
  return <section className="space-y-2" aria-label="評価形状別の静安定性比較">
    <p className="text-xs text-slate-500">同じ速度・迎角・横滑り角・重心で比較してください。各形状の変形は固定し、尾翼は設定済みの形状を使います。</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><caption className="mb-2 text-left font-medium">評価形状別の静安定性比較</caption>
      <thead><tr>{["ケース", "評価形状", "速度 m/s", "β °", "重心X/Z m", "評価迎角 °", "静安定余裕 %", "Cmα /deg", "Crβ /rad", "CYβ /rad", "Cnβ /rad", "状態"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
      <tbody>{results.map((result) => {
        const summary = summarizeAircraftStability(result.rows); const settings = result.caseSnapshot;
        const cgX = settings?.cgX ?? result.rows[0]?.cgX ?? (result.aircraftSnapshot ? result.aircraftSnapshot.mac / 4 : undefined);
        const cgZ = settings?.cgZ ?? result.rows[0]?.cgZ ?? 0;
        return <tr key={result.id} className="border-t border-slate-200">{[
          settings?.name ?? result.caseId, stabilityShapeLabel(settings?.stabilityShape), format(settings?.speed, 1),
          format(settings?.beta ?? 0, 1), `${format(cgX)} / ${format(cgZ)}`, format(summary.derivativeAlpha, 2),
          format(summary.staticMarginPercent, 1), format(summary.cmAlphaPerDegree, 4), format(summary.crBetaPerRadian), format(summary.cyBetaPerRadian), format(summary.cnBetaPerRadian),
          result.status === "completed" ? "結果あり" : "要確認",
        ].map((value, i) => <td key={i} className="p-2">{value}</td>)}</tr>;
      })}</tbody>
    </table></div>
  </section>;
}
