import type { WingAnalysisMesh, WingMeshNode } from "../../analysis/services/wingAnalysisMesh";
import type { BeamDeformationPoint } from "../model/types";

export function deformWingAnalysisMesh(
  mesh: WingAnalysisMesh,
  deformation: readonly BeamDeformationPoint[],
  elasticAxisChordFraction: number,
): WingAnalysisMesh {
  if (elasticAxisChordFraction < 0 || elasticAxisChordFraction > 1) throw new Error("弾性軸位置は0から1の範囲で指定してください。");
  if (!deformation.length) throw new Error("構造変形点が必要です。");
  const transformed = new Map<WingMeshNode, WingMeshNode>();
  const nodes = mesh.nodes.map((node) => {
    const beam = interpolateDeformation(deformation, Math.abs(node.y));
    const axis = elasticAxisPoint(mesh.nodes, node, elasticAxisChordFraction);
    const relativeX = node.x - axis.x;
    const relativeZ = node.z - axis.z;
    const twistRadians = beam.twist * Math.PI / 180;
    const cosine = Math.cos(twistRadians);
    const sine = Math.sin(twistRadians);
    const next = {
      ...node,
      x: axis.x + relativeX * cosine + relativeZ * sine,
      z: axis.z + beam.deflection - relativeX * sine + relativeZ * cosine,
    };
    transformed.set(node, next);
    return next;
  });
  return {
    nodes,
    panels: mesh.panels.map((panel) => ({
      ...panel,
      corners: panel.corners.map((corner) => transformed.get(corner)!) as unknown as typeof panel.corners,
    })),
    strips: mesh.strips.map((strip) => {
      const beam = interpolateDeformation(deformation, strip.centerY);
      return {
        ...strip,
        twist: strip.twist + beam.twist,
        dihedral: strip.dihedral + beam.rotation,
      };
    }),
  };
}

function elasticAxisPoint(nodes: readonly WingMeshNode[], target: WingMeshNode, fraction: number) {
  const sameStation = nodes.filter((node) => node.side === target.side && Math.abs(node.y - target.y) < 1e-9);
  const leading = averagePoint(sameStation.filter((node) => Math.abs(node.chordFraction) < 1e-10));
  const trailing = averagePoint(sameStation.filter((node) => Math.abs(node.chordFraction - 1) < 1e-10));
  if (!leading || !trailing) throw new Error("空力メッシュから弾性軸を特定できません。");
  return {
    x: leading.x + (trailing.x - leading.x) * fraction,
    z: leading.z + (trailing.z - leading.z) * fraction,
  };
}

function averagePoint(nodes: readonly WingMeshNode[]) {
  if (!nodes.length) return null;
  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    z: nodes.reduce((sum, node) => sum + node.z, 0) / nodes.length,
  };
}

function interpolateDeformation(points: readonly BeamDeformationPoint[], yPosition: number): BeamDeformationPoint {
  const sorted = [...points].sort((left, right) => left.yPosition - right.yPosition);
  if (yPosition <= sorted[0].yPosition) return sorted[0];
  if (yPosition >= sorted.at(-1)!.yPosition) return sorted.at(-1)!;
  const upperIndex = sorted.findIndex((point) => point.yPosition >= yPosition);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  const ratio = (yPosition - lower.yPosition) / (upper.yPosition - lower.yPosition);
  return {
    yPosition,
    deflection: interpolate(lower.deflection, upper.deflection, ratio),
    rotation: interpolate(lower.rotation, upper.rotation, ratio),
    twist: interpolate(lower.twist, upper.twist, ratio),
  };
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}
