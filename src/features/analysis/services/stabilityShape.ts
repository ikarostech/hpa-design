import type { AircraftGeometry } from "../../aircraft/model/types";
import type { StabilityShape } from "../model/types";
import { stabilityShapeErrors } from "../model/stabilityShape";
import { createWingAnalysisMesh, type WingAnalysisMesh, type WingMeshNode } from "./wingAnalysisMesh";

export function createStabilityWingMesh(aircraft: AircraftGeometry, shape?: StabilityShape): WingAnalysisMesh {
  const errors = stabilityShapeErrors(shape, aircraft.span / 2);
  if (errors.length) throw new Error(errors.join(" "));
  if (shape?.kind === "fsi") {
    if (!sameStabilityGeometry(shape.aircraftSnapshot, aircraft)) throw new Error("FSI元と現在の機体形状が異なります。FSIを更新して形状を選び直してください。");
    return structuredClone(shape.wingMesh);
  }
  const mesh = createWingAnalysisMesh(aircraft.sections);
  if (shape?.kind !== "manual") return mesh;
  const transform = (node: WingMeshNode) => {
    const y = Math.abs(node.y);
    const high = shape.points.findIndex((p) => p.yPosition >= y);
    const b = shape.points[high < 0 ? shape.points.length - 1 : high];
    const a = shape.points[Math.max(0, high - 1)];
    const fraction = a.yPosition === b.yPosition ? 0 : (y - a.yPosition) / (b.yPosition - a.yPosition);
    const deflection = a.deflection + fraction * (b.deflection - a.deflection);
    const twist = (a.twist + fraction * (b.twist - a.twist)) * Math.PI / 180;
    const station = mesh.nodes.filter((n) => n.side === node.side && Math.abs(n.y - node.y) < 1e-9);
    const leading = station.find((n) => n.chordFraction === 0)!;
    const trailing = station.find((n) => n.chordFraction === 1)!;
    const axisX = leading.x + (trailing.x - leading.x) * shape.elasticAxisChordFraction;
    const axisZ = leading.z + (trailing.z - leading.z) * shape.elasticAxisChordFraction;
    const x = node.x - axisX;
    const z = node.z - axisZ;
    return { ...node, x: axisX + x * Math.cos(twist) + z * Math.sin(twist), z: axisZ + deflection - x * Math.sin(twist) + z * Math.cos(twist) };
  };
  return { ...mesh, nodes: mesh.nodes.map(transform), panels: mesh.panels.map((panel) => ({ ...panel, corners: panel.corners.map(transform) as unknown as typeof panel.corners })) };
}

export function sameStabilityGeometry(left: AircraftGeometry, right: AircraftGeometry): boolean {
  return geometryKey(left) === geometryKey(right);
}

function geometryKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(geometryKey).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${geometryKey(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
