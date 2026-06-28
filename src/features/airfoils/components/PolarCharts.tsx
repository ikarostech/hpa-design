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

export type PolarChartPoint = { alpha: number; cl: number; cd: number; cm: number };

export interface PolarChartSeries {
  id: string;
  name: string;
  color: string;
  data: PolarChartPoint[];
}

interface PolarChartsProps {
  data: PolarChartPoint[];
  series?: PolarChartSeries[];
  mode?: "airfoil" | "analysis";
}

export function PolarCharts({ data, series, mode = "airfoil" }: PolarChartsProps) {
  const chartSeries = series ?? [{ id: "current", name: "CL", color: "#2563eb", data }];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Chart title="CL - α">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" type="number" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {chartSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cl" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>
      <Chart title="CD - CL">
        <LineChart>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="cl" type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey="cd" tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {chartSeries.map((item) => (
            <Line key={item.id} data={item.data} type="monotone" dataKey="cd" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </Chart>
      {mode === "analysis" ? (
        <Chart title="Cm - α">
          <LineChart>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey="alpha" unit="°" type="number" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {chartSeries.map((item) => (
              <Line key={item.id} data={item.data} type="monotone" dataKey="cm" name={item.name} stroke={item.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </Chart>
      ) : null}
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="h-64 rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      <ResponsiveContainer width="100%" height="86%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
