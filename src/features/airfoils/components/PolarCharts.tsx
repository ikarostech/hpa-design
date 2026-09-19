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
import type { PolarChartPoint, PolarChartSeries } from "../model/chartTypes";
import { formatChartNumber, formatChartValue } from "../../../shared/lib/chartNumber";

interface PolarChartsProps {
  data: PolarChartPoint[];
  series?: PolarChartSeries[];
  mode?: "airfoil" | "analysis";
}

type DerivedPolarPoint = PolarChartPoint & { ld: number };

export function PolarCharts({ data, series }: PolarChartsProps) {
  const chartSeries = series ?? [{ id: "current", name: "CL", color: "#2563eb", data }];
  const derivedSeries = chartSeries.map((item) => ({
    ...item,
    data: item.data.map(toDerivedPoint),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Chart title="CL - α">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cl" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>

      <Chart title="CD - α">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cd" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>

      <Chart title="CD - CL">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="cl" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis dataKey="cd" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cd" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>

      <Chart title="L/D - α">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="ld" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>

      <Chart title="L/D - CL">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="cl" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis dataKey="ld" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="ld" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>

      <Chart title="Cm - α">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" type="number" tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatChartNumber} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatChartValue} labelFormatter={formatChartValue} />
          <Legend />
          {derivedSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cm" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>
    </div>
  );
}

function toDerivedPoint(point: PolarChartPoint): DerivedPolarPoint {
  return {
    ...point,
    ld: getLiftDragRatio(point),
  };
}

function getLiftDragRatio(point: PolarChartPoint) {
  if (!Number.isFinite(point.cl) || !Number.isFinite(point.cd) || point.cd <= 0) {
    return Number.NaN;
  }

  return Number((point.cl / point.cd).toFixed(2));
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="h-80 rounded-lg border border-slate-200 bg-white p-3 xl:h-96">
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      <ResponsiveContainer width="100%" height="86%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
