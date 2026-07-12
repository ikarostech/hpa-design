import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Airfoil } from "../model/types";
import { getAirfoilShapeDistribution, getAirfoilShapeMetrics } from "../model/shapeMetrics";

interface AirfoilShapeMetricsPanelProps {
  airfoil: Airfoil;
}

export function AirfoilShapeMetricsPanel({ airfoil }: AirfoilShapeMetricsPanelProps) {
  const metrics = getAirfoilShapeMetrics(airfoil);
  const distribution = getAirfoilShapeDistribution(airfoil);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">形状指標</h3>
        <p className="mt-1 text-xs text-slate-500">翼型座標から厚み分布とキャンバー位置を確認します。</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DataBox label="厚み比" value={`${formatNumber(metrics.thicknessRatio, 1)}%`} />
        <DataBox label="最大厚み位置" value={`${formatNumber(metrics.maxThicknessX, 1)}% chord`} />
        <DataBox label="最大キャンバー" value={`${formatNumber(metrics.maxCamber, 1)}%`} />
        <DataBox label="最大キャンバー位置" value={`${formatNumber(metrics.maxCamberX, 1)}% chord`} />
        <DataBox label="LE半径" value={`${formatNumber(metrics.leadingEdgeRadius, 2)}%`} />
        <DataBox label="TE厚" value={`${formatNumber(metrics.trailingEdgeThickness, 2)}%`} />
      </div>
      <div className="h-56 rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-semibold text-slate-800">厚み・キャンバー分布</p>
        <ResponsiveContainer width="100%" height="84%">
          <LineChart data={distribution}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey="x" unit="%" type="number" tick={{ fontSize: 12 }} />
            <YAxis unit="%" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="thickness" name="厚み" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="camber" name="キャンバー" stroke="#0f766e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function formatNumber(value: number, digits: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(digits);
}
