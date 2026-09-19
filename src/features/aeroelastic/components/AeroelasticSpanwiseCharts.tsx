import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatChartNumber, formatChartValue } from "../../../shared/lib/chartNumber";
import type { StaticAeroelasticResult } from "../services/staticAeroelasticSolver";

type ChartDatum = { y: number } & Record<string, number | null>;
type ChartSeries = { key: string; label: string; color: string };

export function AeroelasticSpanwiseCharts({ result, profileDragPerLength }: {
  result: StaticAeroelasticResult;
  profileDragPerLength?: readonly { yPosition: number; value: number }[];
}) {
  const aero: ChartDatum[] = result.spanLoads.map((point, index) => ({
    y: point.yPosition,
    lift: point.liftPerLength,
    inducedDrag: point.dragPerLength,
    profileDrag: profileDragPerLength?.[index]?.value ?? null,
    torque: point.torquePerLength,
  }));
  const structure: ChartDatum[] = result.structuralResult.points.map((point) => ({
    y: point.yPosition,
    deflection: point.deflection,
    twistDegrees: point.twist,
    shear: point.shearForce,
    bending: point.bendingMoment,
    torque: point.torque,
    reserveFactor: Number.isFinite(point.minReserveFactor) ? Math.min(point.minReserveFactor, 10) : 10,
  }));

  return <div className="grid gap-4 xl:grid-cols-2">
    <SpanwiseChart title="揚力分布" ariaLabel="FSI 翼幅方向の揚力分布" unit="N/m" data={aero} series={[{ key: "lift", label: "揚力", color: "#2563eb" }]} />
    <SpanwiseChart title="抗力分布" ariaLabel="FSI 翼幅方向の抗力分布" unit="N/m" data={aero} series={[{ key: "inducedDrag", label: "誘導抗力", color: "#0891b2" }, ...(profileDragPerLength ? [{ key: "profileDrag", label: "翼型抗力（推定）", color: "#7c3aed" }] : [])]} />
    <SpanwiseChart title="空力トルク分布" ariaLabel="FSI 翼幅方向の空力トルク分布" unit="Nm/m" data={aero} series={[{ key: "torque", label: "弾性軸まわり", color: "#d97706" }]} zeroLine />
    <SpanwiseChart title="たわみ分布" ariaLabel="FSI 翼幅方向のたわみ分布" unit="m" data={structure} series={[{ key: "deflection", label: "たわみ", color: "#2563eb" }]} zeroLine />
    <SpanwiseChart title="ねじれ分布" ariaLabel="FSI 翼幅方向のねじれ分布" unit="°" data={structure} series={[{ key: "twistDegrees", label: "ねじれ", color: "#7c3aed" }]} zeroLine />
    <SpanwiseChart title="せん断力分布" ariaLabel="FSI 翼幅方向のせん断力分布" unit="N" data={structure} series={[{ key: "shear", label: "せん断力", color: "#0f766e" }]} zeroLine />
    <SpanwiseChart title="曲げ・ねじりモーメント" ariaLabel="FSI 翼幅方向の曲げ・ねじりモーメント分布" unit="Nm" data={structure} series={[{ key: "bending", label: "曲げ", color: "#dc2626" }, { key: "torque", label: "ねじり", color: "#d97706" }]} zeroLine />
    <SpanwiseChart title="最小安全率（10以上は上限表示）" ariaLabel="FSI 翼幅方向の安全率分布" data={structure} series={[{ key: "reserveFactor", label: "最小安全率", color: "#7c3aed" }]} referenceValue={1} domain={[0, 10]} />
  </div>;
}

function SpanwiseChart({ title, ariaLabel, unit, data, series, zeroLine = false, referenceValue, domain }: {
  title: string;
  ariaLabel: string;
  unit?: string;
  data: readonly ChartDatum[];
  series: readonly ChartSeries[];
  zeroLine?: boolean;
  referenceValue?: number;
  domain?: [number, number];
}) {
  return <section className="rounded-md border border-slate-200 p-3">
    <h4 className="mb-1 text-sm font-semibold text-slate-900">{title}</h4>
    <p className="mb-2 text-xs text-slate-500">横軸: 半翼幅 (m) / 縦軸: {unit ?? "無次元"}</p>
    <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      {series.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </div>
    <div role="img" aria-label={ariaLabel} className="h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={[...data]} margin={{ top: 10, right: 14, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="y" type="number" domain={["dataMin", "dataMax"]} unit=" m" tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} />
          <YAxis unit={unit ? ` ${unit}` : undefined} tickFormatter={formatChartNumber} tick={{ fontSize: 11 }} width={78} domain={domain} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          {zeroLine ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
          {referenceValue !== undefined ? <ReferenceLine y={referenceValue} stroke="#7c3aed" strokeDasharray="4 4" /> : null}
          {series.map((item) => <Line key={item.key} dataKey={item.key} name={item.label} stroke={item.color} dot={false} strokeWidth={2} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </section>;
}
