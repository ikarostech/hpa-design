import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartNumber, formatChartValue } from "../../../shared/lib/chartNumber";
import type { CarbonMaterial, StructuralDesign } from "../model/types";
import { calculateStructuralDesignProperties } from "../services/structuralAnalysis";

export function StructuralDesignPropertiesChart({ design, materials, selectedSectionId }: {
  design: StructuralDesign;
  materials: readonly CarbonMaterial[];
  selectedSectionId?: string | null;
}) {
  let points;
  try {
    points = calculateStructuralDesignProperties(design, materials);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "パイプ設計値を確認してください。";
    return <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-4 text-sm text-amber-800">グラフを表示できません。{detail}</p>;
  }

  if (!points.length) {
    return <p role="status" className="text-sm text-slate-500">パイプセクションを追加すると設計特性を表示します。</p>;
  }

  const minimumStrength = Math.min(...points.map((point) => point.governingBendingStrength));
  const chartData = points.map((point) => ({
    ...point,
    laminateBendingStrengthMpa: point.laminateBendingStrength / 1e6,
    localBucklingStrengthMpa: point.localBucklingStrength === undefined ? null : point.localBucklingStrength / 1e6,
    brazierStrengthMpa: point.brazierStrength === undefined ? null : point.brazierStrength / 1e6,
  }));
  const hasUnavailableBucklingModes = points.some((point) => point.localBucklingStrength === undefined || point.brazierStrength === undefined);
  const selectedPoint = points.find((point) => point.sectionId === selectedSectionId) ?? points[0];

  return <div className="space-y-5">
    <section aria-label="曲げ強度・破壊モード" className="rounded-md border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-900">曲げ強度・破壊モード</h3>
      <div className="my-3 max-w-sm">
        <Metric label="最小支配曲げ強度" value={`${(minimumStrength / 1e6).toFixed(1)} MPa`} />
      </div>
      <section aria-label="選択区間の初期層破壊" className="mb-3 rounded-md border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-700">選択区間：{selectedPoint.sectionId}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Detail label="公称曲げ強度" value={`${(selectedPoint.laminateBendingStrength / 1e6).toFixed(1)} MPa`} />
          <Detail label="支配モード" value={selectedPoint.laminateFailureMode} />
          <Detail label="支配層" value={selectedPoint.laminateFailurePlyId} />
        </div>
      </section>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <Legend color="#16a34a" label="初期層破壊曲げ強度（Hashin）" />
        <Legend color="#d97706" label="局部座屈強度" />
        <Legend color="#9333ea" label="Brazier扁平化強度" />
      </div>
      <div role="img" aria-label="パイプ設計の曲げ強度と破壊モード" className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 12, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="yPosition" type="number" domain={["dataMin", "dataMax"]} unit=" m" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} />
            <YAxis unit=" MPa" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} width={74} />
            <Tooltip content={(tooltip) => <StrengthTooltip active={tooltip.active} label={tooltip.label} point={tooltip.payload?.[0]?.payload as ChartPoint | undefined} />} />
            <Line dataKey="laminateBendingStrengthMpa" name="初期層破壊曲げ強度（Hashin）" stroke="#16a34a" dot={false} strokeWidth={2} />
            <Line dataKey="localBucklingStrengthMpa" name="局部座屈強度" stroke="#d97706" strokeDasharray="6 3" dot={false} strokeWidth={2} />
            <Line dataKey="brazierStrengthMpa" name="Brazier扁平化強度" stroke="#9333ea" strokeDasharray="3 3" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">入力中の外径・積層・材料から即時計算します。初期層破壊はHashin則の繊維／母材・引張／圧縮モードを全層で評価します。各強度は比較のため公称外縁強度へ換算し、最小値を支配曲げ強度とします。</p>
      {hasUnavailableBucklingModes ? <p className="mt-1 text-xs text-amber-700">部分積層区間の局部座屈とBrazier扁平化は現在の評価対象外です。</p> : null}
    </section>

    <section aria-label="曲げ剛性" className="rounded-md border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-900">曲げ剛性</h3>
      <p className="mb-2 text-xs text-slate-500">パイプ設計から算出した翼幅方向の曲げ剛性 EI です。</p>
      <div className="mb-2 flex text-xs text-slate-600"><Legend color="#2563eb" label="曲げ剛性 EI" /></div>
      <div role="img" aria-label="パイプ設計の曲げ剛性" className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 12, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="yPosition" type="number" domain={["dataMin", "dataMax"]} unit=" m" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} />
            <YAxis unit=" N·m²" tickFormatter={(value: number) => value.toExponential(1)} tick={{ fontSize: 11 }} width={86} />
            <Tooltip content={(tooltip) => <StiffnessTooltip active={tooltip.active} label={tooltip.label} point={tooltip.payload?.[0]?.payload as ChartPoint | undefined} />} />
            <Line dataKey="bendingStiffness" name="曲げ剛性 EI" stroke="#2563eb" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 px-3 py-2">
    <p className="text-xs text-slate-500">{label}</p>
    <output aria-label={label} className="mt-1 block text-sm font-semibold text-slate-900">{value}</output>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
}

type ChartPoint = ReturnType<typeof calculateStructuralDesignProperties>[number] & {
  laminateBendingStrengthMpa: number;
  localBucklingStrengthMpa: number | null;
  brazierStrengthMpa: number | null;
};

function StrengthTooltip({ active, label, point }: { active?: boolean; label?: string | number; point?: ChartPoint }) {
  if (!active || !point) return null;
  return <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
    <p className="font-semibold text-slate-900">{formatChartValue(Number(label))} m / {point.sectionId}</p>
    <p className="mt-2 text-green-700">公称曲げ強度：{formatChartNumber(point.laminateBendingStrengthMpa)} MPa</p>
    <p>支配モード：{point.laminateFailureMode}</p>
    <p>支配層：{point.laminateFailurePlyId}</p>
    {point.localBucklingStrengthMpa === null ? null : <p className="mt-1 text-amber-700">局部座屈：{formatChartNumber(point.localBucklingStrengthMpa)} MPa</p>}
    {point.brazierStrengthMpa === null ? null : <p className="text-purple-700">Brazier扁平化：{formatChartNumber(point.brazierStrengthMpa)} MPa</p>}
  </div>;
}

function StiffnessTooltip({ active, label, point }: { active?: boolean; label?: string | number; point?: ChartPoint }) {
  if (!active || !point) return null;
  return <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
    <p className="font-semibold text-slate-900">{formatChartValue(Number(label))} m / {point.sectionId}</p>
    <p className="mt-2 text-blue-700">曲げ剛性 EI：{point.bendingStiffness.toExponential(2)} N·m²</p>
  </div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: color }} />{label}</span>;
}
