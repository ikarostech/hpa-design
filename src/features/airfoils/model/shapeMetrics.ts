import type { Airfoil } from "./types";

export interface AirfoilShapeMetrics {
  thicknessRatio: number;
  maxThicknessX: number;
  maxCamber: number;
  maxCamberX: number;
  leadingEdgeRadius: number;
  trailingEdgeThickness: number;
}

export interface AirfoilShapeDistributionPoint {
  x: number;
  thickness: number;
  camber: number;
}

export function getAirfoilShapeMetrics(airfoil: Airfoil): AirfoilShapeMetrics {
  const distribution = getAirfoilShapeDistribution(airfoil);
  const maxThicknessPoint = distribution.reduce(
    (best, point) => (point.thickness > best.thickness ? point : best),
    distribution[0],
  );
  const maxCamberPoint = distribution.reduce(
    (best, point) => (point.camber > best.camber ? point : best),
    distribution[0],
  );

  return {
    thicknessRatio: airfoil.thicknessRatio,
    maxThicknessX: maxThicknessPoint?.x ?? Number.NaN,
    maxCamber: airfoil.maxCamber,
    maxCamberX: maxCamberPoint?.x ?? Number.NaN,
    leadingEdgeRadius: airfoil.leadingEdgeRadius,
    trailingEdgeThickness: airfoil.trailingEdgeThickness,
  };
}

export function getAirfoilShapeDistribution(airfoil: Airfoil): AirfoilShapeDistributionPoint[] {
  return airfoil.coordinates.map((point) => ({
    x: Number((point.x * 100).toFixed(1)),
    thickness: Number(((point.upper - point.lower) * 100).toFixed(3)),
    camber: Number((((point.upper + point.lower) / 2) * 100).toFixed(3)),
  }));
}
