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
    <section className="rounded-md border border-slate-200 p-3">
      <div className="mb-2">
        <h4 className="text-sm font-semibold text-slate-900">荷重・曲げ分布</h4>
        <p className="text-xs text-slate-500">横軸: 半翼幅 / 左軸: 空力・構造荷重 / 右軸: 曲げモーメント・耐荷重</p>
      </div>
      <ChartLegend names={["aerodynamicLift", "aerodynamicDrag", "structuralLift", "bendingMoment", "bendingCapacity", "reserveFactor"]} />
      <div role="img" aria-label="翼幅方向の荷重・曲げ分布" className="h-80 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 14, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} unit=" m" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="force" unit=" N/m" tick={{ fontSize: 11 }} width={70} />
            <YAxis yAxisId="moment" orientation="right" unit=" Nm" tick={{ fontSize: 11 }} width={68} />
            <YAxis yAxisId="reserve" orientation="right" hide domain={[0, "auto"]} />
            <Tooltip />
            <ReferenceLine yAxisId="reserve" y={1} stroke="#7c3aed" strokeDasharray="4 4" />
            <Line yAxisId="force" dataKey="aerodynamicLift" name={series.aerodynamicLift.label} stroke={series.aerodynamicLift.color} dot={false} strokeWidth={2} />
            <Line yAxisId="force" dataKey="aerodynamicDrag" name={series.aerodynamicDrag.label} stroke={series.aerodynamicDrag.color} dot={false} strokeWidth={2} strokeDasharray="3 3" />
            <Line yAxisId="force" dataKey="structuralLift" name={series.structuralLift.label} stroke={series.structuralLift.color} dot={false} strokeWidth={2} strokeDasharray="7 3" />
            <Line yAxisId="moment" dataKey="bendingMoment" name={series.bendingMoment.label} stroke={series.bendingMoment.color} dot={false} strokeWidth={2} />
            <Line yAxisId="moment" dataKey="bendingCapacity" name={series.bendingCapacity.label} stroke={series.bendingCapacity.color} dot={false} strokeWidth={2} strokeDasharray="6 4" connectNulls />
            <Line yAxisId="reserve" dataKey="reserveFactor" name={series.reserveFactor.label} stroke={series.reserveFactor.color} dot={false} strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>

    <section className="rounded-md border border-slate-200 p-3">
      <div className="mb-2">
        <h4 className="text-sm font-semibold text-slate-900">ねじり分布</h4>
        <p className="text-xs text-slate-500">横軸: 半翼幅 / 左軸: ねじりモーメント・耐荷重 / 右軸: 空力ねじり荷重</p>
      </div>
      <ChartLegend names={["aerodynamicTorque", "torque", "torqueCapacity"]} />
      <div role="img" aria-label="翼幅方向のねじり分布" className="h-80 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 14, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} unit=" m" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="moment" unit=" Nm" tick={{ fontSize: 11 }} width={72} />
            <YAxis yAxisId="distributedTorque" orientation="right" unit=" Nm/m" tick={{ fontSize: 11 }} width={78} />
            <Tooltip />
            <ReferenceLine yAxisId="moment" y={0} stroke="#94a3b8" />
            <Line yAxisId="distributedTorque" dataKey="aerodynamicTorque" name={series.aerodynamicTorque.label} stroke={series.aerodynamicTorque.color} dot={false} strokeWidth={2} />
            <Line yAxisId="moment" dataKey="torque" name={series.torque.label} stroke={series.torque.color} dot={false} strokeWidth={2} />
            <Line yAxisId="moment" dataKey="torqueCapacity" name={series.torqueCapacity.label} stroke={series.torqueCapacity.color} dot={false} strokeWidth={2} strokeDasharray="6 4" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
    {capacityUnavailable ? <p className="text-xs text-amber-700 xl:col-span-2">旧形式の構造結果では耐荷重を表示できません。構造解析を再実行してください。</p> : null}
  </div>;
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
      reserveFactor: structure?.combinedReserveFactor ?? null,
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
