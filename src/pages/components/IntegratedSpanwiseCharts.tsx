import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisResult } from "../../features/analysis/model/types";
import type { AerodynamicSpanDistribution } from "../../features/analysis/model/spanwiseDistribution";
import type { StructuralAnalysisResult } from "../../features/structures/model/types";
import { toStructuralSpanDistribution } from "../../features/structures/services/structuralResultDistribution";
import { interpolateDistribution, mergeDistributionCoordinates } from "../../shared/lib/distribution";
import { formatChartNumber, formatChartValue } from "../../shared/lib/chartNumber";

const series = {
  aerodynamicLift: { label: "空力揚力分布", color: "#2563eb" },
  aerodynamicDrag: { label: "空力抗力分布", color: "#0891b2" },
  structuralLift: { label: "構造解析適用荷重", color: "#1d4ed8" },
  bendingMoment: { label: "曲げモーメント", color: "#dc2626" },
  bendingCapacity: { label: "曲げ耐荷重", color: "#16a34a" },
  reserveFactor: { label: "安全率", color: "#7c3aed" },
  torque: { label: "ねじりモーメント", color: "#d97706" },
  torqueCapacity: { label: "ねじり耐荷重", color: "#0f766e" },
  aerodynamicTorque: { label: "空力ねじり荷重", color: "#ea580c" },
} as const;

export function IntegratedSpanwiseCharts({ structuralResult, aerodynamicResult, alphaDegrees }: {
  aerodynamicResult?: AnalysisResult;
  structuralResult: StructuralAnalysisResult;
  alphaDegrees?: number;
}) {
  const aerodynamicRow = aerodynamicResult?.rows.find((row) => row.spanwise && (alphaDegrees === undefined || Math.abs(row.alpha - alphaDegrees) < 1e-9))
    ?? [...(aerodynamicResult?.rows ?? [])].sort((left, right) => right.cl - left.cl).find((row) => row.spanwise);
  const points = buildIntegratedChartData(structuralResult, aerodynamicRow?.spanwise);
  const capacityUnavailable = structuralResult.points.some((point) => !Number.isFinite(point.bendingMomentCapacity) || !Number.isFinite(point.torqueCapacity));

  return <div className="grid gap-4 xl:grid-cols-2">
    <SpanwiseChart title="揚力・構造荷重分布" ariaLabel="翼幅方向の揚力・構造荷重分布" unit="N/m" data={points} names={["aerodynamicLift", "structuralLift"]} />
    <SpanwiseChart title="抗力分布" ariaLabel="翼幅方向の抗力分布" unit="N/m" data={points} names={["aerodynamicDrag"]} />
    <SpanwiseChart title="曲げモーメント" ariaLabel="翼幅方向の曲げモーメント" unit="Nm" data={points} names={["bendingMoment"]} zeroLine />
    <SpanwiseChart title="曲げ耐荷重" ariaLabel="翼幅方向の曲げ耐荷重" unit="Nm" data={points} names={["bendingCapacity"]} />
    <SpanwiseChart title="安全率（10以上は上限表示）" ariaLabel="翼幅方向の安全率" data={points} names={["reserveFactor"]} referenceValue={1} domain={[0, 10]} />
    <SpanwiseChart title="空力ねじり荷重" ariaLabel="翼幅方向の空力ねじり荷重" unit="Nm/m" data={points} names={["aerodynamicTorque"]} zeroLine />
    <SpanwiseChart title="ねじりモーメント" ariaLabel="翼幅方向のねじりモーメント" unit="Nm" data={points} names={["torque"]} zeroLine />
    <SpanwiseChart title="ねじり耐荷重" ariaLabel="翼幅方向のねじり耐荷重" unit="Nm" data={points} names={["torqueCapacity"]} />
    {capacityUnavailable ? <p className="text-xs text-amber-700 xl:col-span-2">旧形式の構造結果では耐荷重を表示できません。構造解析を再実行してください。</p> : null}
  </div>;
}

type ChartPoint = ReturnType<typeof buildIntegratedChartData>[number];
type SeriesName = keyof typeof series;

function SpanwiseChart({ title, ariaLabel, unit, data, names, referenceValue, zeroLine = false, domain }: {
  title: string;
  ariaLabel: string;
  unit?: string;
  data: readonly ChartPoint[];
  names: readonly SeriesName[];
  referenceValue?: number;
  zeroLine?: boolean;
  domain?: [number, number | "auto"];
}) {
  return <section className="rounded-md border border-slate-200 p-3">
    <div className="mb-2">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <p className="text-xs text-slate-500">横軸: 半翼幅{unit ? ` / 縦軸: ${unit}` : " / 縦軸: 無次元"}</p>
    </div>
    <ChartLegend names={names} />
    <div role="img" aria-label={ariaLabel} className="h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} unit=" m" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} />
          <YAxis unit={unit ? ` ${unit}` : undefined} tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} width={unit === "Nm/m" ? 78 : 72} domain={domain} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          {zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
          {referenceValue !== undefined ? <ReferenceLine y={referenceValue} stroke="#7c3aed" strokeDasharray="4 4" /> : null}
          {names.map((name) => <Line key={name} dataKey={name} name={series[name].label} stroke={series[name].color} dot={false} strokeWidth={2} strokeDasharray={name === "structuralLift" ? "7 3" : name.endsWith("Capacity") ? "6 4" : undefined} connectNulls />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}

export function buildIntegratedChartData(result: StructuralAnalysisResult, aerodynamic?: AerodynamicSpanDistribution) {
  const structural = toStructuralSpanDistribution(result);
  const positions = mergeDistributionCoordinates(aerodynamic ? [structural, aerodynamic] : [structural]);
  return positions.map((position) => {
    const structure = interpolateDistribution(structural, position);
    const aero = aerodynamic ? interpolateDistribution(aerodynamic, position) : null;
    return {
      y: position,
      aerodynamicLift: aero?.liftPerLength ?? null,
      aerodynamicDrag: aero?.dragPerLength ?? null,
      aerodynamicTorque: aero?.torqueAboutElasticAxisPerLength ?? null,
      structuralLift: structure?.distributedLift ?? null,
      bendingMoment: structure?.bendingMoment ?? null,
      bendingCapacity: structure?.bendingMomentCapacity ?? null,
      reserveFactor: structure?.combinedReserveFactor === undefined || structure.combinedReserveFactor === null
        ? null
        : Math.min(structure.combinedReserveFactor, 10),
      torque: structure?.torque ?? null,
      torqueCapacity: structure?.torqueCapacity ?? null,
    };
  });
}

function ChartLegend({ names }: { names: readonly (keyof typeof series)[] }) {
  return <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
    {names.map((name) => <span key={name} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: series[name].color }} />{series[name].label}</span>)}
  </div>;
}
