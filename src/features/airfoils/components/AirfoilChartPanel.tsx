import type { PolarChartPoint, PolarChartSeries } from "../model/chartTypes";
import { PolarCharts } from "./PolarCharts";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilChartPanelProps {
  data: PolarChartPoint[];
  series: PolarChartSeries[];
}

export function AirfoilChartPanel({ data, series }: AirfoilChartPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">解析グラフ</h2>
      </CardHeader>
      <CardBody>
        <PolarCharts data={data} series={series} />
      </CardBody>
    </Card>
  );
}
