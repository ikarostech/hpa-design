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

interface PolarChartsProps {
  data: Array<{ alpha: number; cl: number; cd: number; cm: number }>;
  mode?: "airfoil" | "analysis";
}

export function PolarCharts({ data, mode = "airfoil" }: PolarChartsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Chart title="CL - α">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="alpha" unit="°" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="cl" name="CL" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </Chart>
      <Chart title="CD - CL">
        <LineChart data={data}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="cl" tick={{ fontSize: 12 }} />
          <YAxis dataKey="cd" tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="cd" name="CD" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </Chart>
      {mode === "analysis" ? (
        <Chart title="Cm - α">
          <LineChart data={data}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey="alpha" unit="°" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cm" name="Cm" stroke="#7c3aed" strokeWidth={2} dot={false} />
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
