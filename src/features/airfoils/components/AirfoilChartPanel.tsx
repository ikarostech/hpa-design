import type { PolarChartPoint, PolarChartSeries } from "../model/chartTypes";
import { PolarCharts } from "./PolarCharts";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilChartPanelProps {
  data: PolarChartPoint[];
  series: PolarChartSeries[];
}

interface PolarSummary {
  id: string;
  name: string;
  color: string;
  clMax: number;
  cdMin: number;
  maxLd: number;
  alphaAtMaxLd: number;
}

export function AirfoilChartPanel({ data, series }: AirfoilChartPanelProps) {
  const chartSeries = series.length > 0 ? series : [{ id: "current", name: "Current", color: "#2563eb", data }];
  const summaries = chartSeries.map(toPolarSummary);

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">解析グラフ</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <SummaryTable summaries={summaries} />
        <PolarCharts data={data} series={chartSeries} />
      </CardBody>
    </Card>
  );
}

function SummaryTable({ summaries }: { summaries: PolarSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {["系列", "CLmax", "CDmin", "最大 L/D", "最大 L/D の α"].map((heading) => (
              <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summaries.map((summary) => (
            <tr key={summary.id}>
              <td className="px-3 py-2 font-medium text-slate-900">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: summary.color }} />
                {summary.name}
              </td>
              <td className="px-3 py-2">{formatNumber(summary.clMax, 3)}</td>
              <td className="px-3 py-2">{formatNumber(summary.cdMin, 4)}</td>
              <td className="px-3 py-2">{formatNumber(summary.maxLd, 1)}</td>
              <td className="px-3 py-2">{formatNumber(summary.alphaAtMaxLd, 1)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toPolarSummary(series: PolarChartSeries): PolarSummary {
  const finitePoints = series.data.filter((point) => Number.isFinite(point.cl) && Number.isFinite(point.cd));
  const clMaxPoint = finitePoints.reduce((best, point) => (point.cl > best.cl ? point : best), finitePoints[0]);
  const cdMinPoint = finitePoints.reduce((best, point) => (point.cd < best.cd ? point : best), finitePoints[0]);
  const maxLdPoint = finitePoints.reduce((best, point) => (getLiftDragRatio(point) > getLiftDragRatio(best) ? point : best), finitePoints[0]);

  return {
    id: series.id,
    name: series.name,
    color: series.color,
    clMax: clMaxPoint?.cl ?? Number.NaN,
    cdMin: cdMinPoint?.cd ?? Number.NaN,
    maxLd: maxLdPoint ? getLiftDragRatio(maxLdPoint) : Number.NaN,
    alphaAtMaxLd: maxLdPoint?.alpha ?? Number.NaN,
  };
}

function getLiftDragRatio(point: PolarChartPoint) {
  if (!Number.isFinite(point.cl) || !Number.isFinite(point.cd) || point.cd <= 0) {
    return Number.NaN;
  }

  return point.cl / point.cd;
}

function formatNumber(value: number, digits: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(digits);
}
