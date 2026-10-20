import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "../model/types";
import { formatChartNumber, formatChartValue } from "../../../shared/lib/chartNumber";

const charts = [
  { key: "cm", title: "縦安定・トリム Cm - α", unit: "" },
  { key: "crBeta", title: "上反角効果 Crβ - α", unit: " /rad" },
  { key: "cyBeta", title: "横力微係数 CYβ - α", unit: " /rad" },
  { key: "cnBeta", title: "方向静安定 Cnβ - α", unit: " /rad" },
] as const;

export function StabilityCharts({ results }: { results: readonly AnalysisResult[] }) {
  return <div className="grid min-w-0 gap-4 lg:grid-cols-2">
    {charts.map(({ key, title, unit }) => <figure key={key} aria-label={title} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <figcaption className="mb-2 text-sm font-semibold text-slate-800">{title}</figcaption>
      {results.some((result) => result.rows.some((row) => Number.isFinite(row[key]))) ? <div className="h-72">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 288 }}>
          <LineChart>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey="alpha" type="number" unit="°" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
            <YAxis unit={unit} tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
            <Tooltip formatter={formatChartValue} labelFormatter={(value) => `α ${formatChartValue(value)}°`} />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            {results.map((result, index) => <Line key={result.id}
              data={result.rows.filter((row) => Number.isFinite(row.alpha)).map((row) => ({ alpha: row.alpha, value: Number.isFinite(row[key]) ? row[key] : null })).sort((a, b) => a.alpha - b.alpha)}
              dataKey="value" name={result.caseSnapshot?.name ?? result.caseId} type="linear" stroke={["#2563eb", "#0f766e", "#dc2626", "#7c3aed"][index % 4]}
              strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div> : <p className="py-10 text-center text-sm text-slate-500">未算出（再解析してください）</p>}
    </figure>)}
  </div>;
}
