export type PolarChartPoint = { alpha: number; cl: number; cd: number; cm: number };

export interface PolarChartSeries {
  id: string;
  name: string;
  color: string;
  data: PolarChartPoint[];
}
