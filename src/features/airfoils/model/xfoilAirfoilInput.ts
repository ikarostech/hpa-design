import type { Airfoil } from "./types";

// XFOIL's loaded-airfoil buffer must stay below 160 perimeter points.
const maxSurfaceStations = 79;

export type XfoilAirfoilInput =
  | { kind: "naca"; code: string }
  | { kind: "file"; text: string };

export function buildXfoilAirfoilInput(airfoil: Airfoil): XfoilAirfoilInput {
  const nacaMatch = /^NACA\s*([0-9]{4})$/i.exec(airfoil.name.trim());
  if (nacaMatch) {
    return { kind: "naca", code: nacaMatch[1] };
  }

  const coordinates = airfoil.coordinates.length > maxSurfaceStations
    ? resampleCoordinates(airfoil.coordinates, maxSurfaceStations)
    : airfoil.coordinates;
  const upper = [...coordinates].reverse().map((point) => `${point.x.toFixed(6)} ${point.upper.toFixed(6)}`);
  const lower = coordinates.slice(1).map((point) => `${point.x.toFixed(6)} ${point.lower.toFixed(6)}`);
  return { kind: "file", text: [airfoil.name, ...upper, ...lower].join("\n") };
}

function resampleCoordinates(coordinates: Airfoil["coordinates"], stationCount: number): Airfoil["coordinates"] {
  const sorted = [...coordinates].sort((left, right) => left.x - right.x);
  return Array.from({ length: stationCount }, (_, index) => {
    const fraction = index / (stationCount - 1);
    const x = (1 - Math.cos(Math.PI * fraction)) / 2;
    return {
      x,
      upper: interpolateSurface(sorted, x, "upper"),
      lower: interpolateSurface(sorted, x, "lower"),
    };
  });
}

function interpolateSurface(
  coordinates: Airfoil["coordinates"],
  x: number,
  surface: "upper" | "lower",
) {
  if (x <= coordinates[0].x) return coordinates[0][surface];
  const last = coordinates[coordinates.length - 1];
  if (x >= last.x) return last[surface];

  const rightIndex = coordinates.findIndex((point) => point.x >= x);
  const left = coordinates[rightIndex - 1];
  const right = coordinates[rightIndex];
  const ratio = (x - left.x) / (right.x - left.x);
  return left[surface] + (right[surface] - left[surface]) * ratio;
}
