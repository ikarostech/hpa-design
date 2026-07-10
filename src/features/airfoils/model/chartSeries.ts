import type { PolarChartSeries } from "./chartTypes";
import type { Airfoil, AirfoilPolar } from "./types";

const chartColors = ["#2563eb", "#0f766e", "#dc2626", "#7c3aed", "#d97706", "#0891b2"];

export function buildAirfoilChartSeries(
  cases: AirfoilPolar[],
  airfoils: Airfoil[],
): PolarChartSeries[] {
  return cases
    .map((polar, index) => {
      const airfoil = airfoils.find((item) => item.id === polar.airfoilId);

      return {
        id: polar.id,
        name: airfoil ? `${airfoil.name} / ${polar.reynolds.toLocaleString()}` : polar.caseName,
        color: chartColors[index % chartColors.length],
        data: polar.points,
      };
    });
}
