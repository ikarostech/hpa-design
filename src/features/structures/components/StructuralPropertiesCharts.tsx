import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartNumber, formatChartValue } from "../../../shared/lib/chartNumber";
import type { StructuralAnalysisResult } from "../model/types";
import { toStructuralSpanDistribution } from "../services/structuralResultDistribution";

const series = {
  bendingCapacity: { label: "曲げ耐荷重", color: "#16a34a" },
  bendingStiffness: { label: "曲げ剛性 EI", color: "#2563eb" },
  torqueCapacity: { label: "ねじり耐荷重", color: "#0f766e" },
  torsionalStiffness: { label: "ねじり剛性 GJ", color: "#d97706" },
} as const;

export function StructuralPropertiesCharts({ result }: { result: StructuralAnalysisResult }) {
  const points = buildStructuralPropertiesChartData(result);
  const capacityUnavailable = points.some((point) => point.bendingCapacity === null || point.torqueCapacity === null);

  return <>
    <div className="grid gap-4 xl:grid-cols-2">
      <PropertyChart
        title="曲げ強度・剛性分布"
        description="パイプ径・積層構成・材料から求めた許容曲げモーメントと曲げ剛性です。"
        ariaLabel="翼幅方向の曲げ強度・剛性分布"
        data={points}
        capacityKey="bendingCapacity"
        stiffnessKey="bendingStiffness"
      />
      <PropertyChart
        title="ねじり強度・剛性分布"
        description="パイプ径・積層構成・材料から求めた許容ねじりモーメントとねじり剛性です。"
        ariaLabel="翼幅方向のねじり強度・剛性分布"
        data={points}
        capacityKey="torqueCapacity"
        stiffnessKey="torsionalStiffness"
      />
    </div>
    {capacityUnavailable ? <p className="mt-2 text-xs text-amber-700">旧形式の解析結果には耐荷重がありません。現在のパイプ構成で構造解析を再実行してください。</p> : null}
  </>;
}

export function buildStructuralPropertiesChartData(result: StructuralAnalysisResult) {
  return toStructuralSpanDistribution(result).samples.map((sample) => ({
    y: sample.position,
    bendingCapacity: sample.values.bendingMomentCapacity,
    bendingStiffness: sample.values.bendingStiffness,
    torqueCapacity: sample.values.torqueCapacity,
    torsionalStiffness: sample.values.torsionalStiffness,
  }));
}

type PropertyPoint = ReturnType<typeof buildStructuralPropertiesChartData>[number];
type CapacityKey = "bendingCapacity" | "torqueCapacity";
type StiffnessKey = "bendingStiffness" | "torsionalStiffness";

function PropertyChart({ title, description, ariaLabel, data, capacityKey, stiffnessKey }: {
  title: string;
  description: string;
  ariaLabel: string;
  data: readonly PropertyPoint[];
  capacityKey: CapacityKey;
  stiffnessKey: StiffnessKey;
}) {
  return <section className="rounded-md border border-slate-200 p-3">
    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    <p className="mb-2 text-xs text-slate-500">{description}</p>
    <ChartLegend names={[capacityKey, stiffnessKey]} />
    <div role="img" aria-label={ariaLabel} className="h-72 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} unit=" m" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} />
          <YAxis yAxisId="capacity" unit=" Nm" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} width={72} />
          <YAxis yAxisId="stiffness" orientation="right" unit=" Nm²" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} width={82} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Line yAxisId="capacity" dataKey={capacityKey} name={series[capacityKey].label} stroke={series[capacityKey].color} dot={false} strokeWidth={2} connectNulls />
          <Line yAxisId="stiffness" dataKey={stiffnessKey} name={series[stiffnessKey].label} stroke={series[stiffnessKey].color} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}

function ChartLegend({ names }: { names: readonly (keyof typeof series)[] }) {
  return <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
    {names.map((name) => <span key={name} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: series[name].color }} />{series[name].label}</span>)}
  </div>;
}
