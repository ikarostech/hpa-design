import { formatChartNumber } from "../../../shared/lib/chartNumber";
import type { StructuralLoadCase } from "../model/types";

const seriesColors = ["#2563eb", "#0f766e", "#dc2626", "#7c3aed", "#d97706"];

export function StructuralLoadComparisonChart({ loadCases }: { loadCases: readonly StructuralLoadCase[] }) {
  if (!loadCases.length) return <p className="flex h-64 items-center justify-center text-sm text-slate-500">表示する荷重ケースを選択してください。</p>;

  const points = loadCases.flatMap((loadCase) => loadCase.distributedLoads);
  if (!points.length) return <p className="flex h-64 items-center justify-center text-sm text-slate-500">表示できる荷重点がありません。</p>;
  const maxX = Math.max(...points.map((point) => point.yPosition), 1);
  const minValue = Math.min(0, ...points.map((point) => point.liftPerLength));
  const maxValue = Math.max(0, ...points.map((point) => point.liftPerLength));
  const range = maxValue - minValue || 1;
  const x = (value: number) => 48 + value / maxX * 704;
  const y = (value: number) => 188 - (value - minValue) / range * 148;

  return <div>
    <div className="mb-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
      {loadCases.map((loadCase, index) => <span key={loadCase.id} className="inline-flex items-center gap-2">
        <span className="h-0.5 w-5" style={{ backgroundColor: seriesColors[index % seriesColors.length] }} />
        {loadCase.name}
      </span>)}
    </div>
    <svg viewBox="0 0 800 220" className="h-64 w-full" role="img" aria-label="表示中の構造荷重ケース">
      <line x1="48" y1={y(0)} x2="752" y2={y(0)} stroke="#cbd5e1" />
      <line x1="48" y1="40" x2="48" y2="188" stroke="#cbd5e1" />
      {loadCases.map((loadCase, index) => <polyline
        key={loadCase.id}
        points={[...loadCase.distributedLoads]
          .sort((left, right) => left.yPosition - right.yPosition)
          .map((point) => `${x(point.yPosition)},${y(point.liftPerLength)}`)
          .join(" ")}
        fill="none"
        stroke={seriesColors[index % seriesColors.length]}
        strokeWidth="3"
      />)}
      <text x="52" y="28" fontSize="12" fill="#64748b">分布荷重 {formatChartNumber(maxValue)} N/m</text>
      <text x="752" y="210" textAnchor="end" fontSize="12" fill="#64748b">Y {formatChartNumber(maxX)} m</text>
    </svg>
  </div>;
}
