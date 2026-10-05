import type { AircraftGeometry, AircraftPosition, TailSurface } from "../../aircraft/model/types";
import { validateTailSurface } from "../../aircraft/model/tailGeometry";
import { createWingAnalysisMesh, panelFractions, type WingMeshNode, type WingMeshPanel } from "./wingAnalysisMesh";

export interface AircraftMeshPanel extends WingMeshPanel {
  surfaceId: string;
}

/** Aircraft axes: X aft, Y right, Z up, distances in metres. Incidence is baked into nodes. */
export interface AircraftAnalysisMesh {
  nodes: WingMeshNode[];
  panels: AircraftMeshPanel[];
}

export function createAircraftAnalysisMesh(aircraft: AircraftGeometry): AircraftAnalysisMesh {
  const wing = createWingAnalysisMesh(aircraft.sections);
  const transform = (node: WingMeshNode): WingMeshNode => ({ ...node, ...rotateIncidence(node, aircraft.incidence) });
  const meshes: AircraftAnalysisMesh[] = [{
    nodes: wing.nodes.map(transform),
    panels: wing.panels.map((panel) => ({ ...panel, surfaceId: aircraft.id,
      corners: [transform(panel.corners[0]), transform(panel.corners[1]), transform(panel.corners[2]), transform(panel.corners[3])],
    })),
  }, ...(aircraft.tailSurfaces ?? []).map(createTailAnalysisMesh)];
  return { nodes: meshes.flatMap((mesh) => mesh.nodes), panels: meshes.flatMap((mesh) => mesh.panels) };
}

export function createTailAnalysisMesh(surface: TailSurface): AircraftAnalysisMesh {
  const foilIds = new Set(surface.sections.flatMap((section) => [section.leftAirfoilId, section.rightAirfoilId]));
  const errors = validateTailSurface(surface, foilIds);
  if (errors.length) throw new Error(errors.join(" "));
  if (surface.isSymmetricFin) throw new Error("Symmetric fin arrangement is not supported by the analysis mesh yet.");
  if (surface.isDoubleFin && surface.rootPosition.y === 0) throw new Error("Double fins require a nonzero lateral root position.");
  const nodes: WingMeshNode[] = [];
  const panels: AircraftMeshPanel[] = [];
  const vertical = surface.orientation === "vertical";
  const sides: WingMeshNode["side"][] = vertical && !surface.isDoubleFin ? ["right"] : ["right", "left"];
  let span = 0;
  let height = 0;
  let stripIndex = 0;

  for (let sectionIndex = 0; sectionIndex < surface.sections.length - 1; sectionIndex += 1) {
    const root = surface.sections[sectionIndex];
    const tip = surface.sections[sectionIndex + 1];
    const angle = root.dihedral * Math.PI / 180;
    const length = tip.spanPosition - root.spanPosition;
    const spanEnd = span + length * Math.cos(angle);
    const heightEnd = height + length * Math.sin(angle);
    const spanFractions = panelFractions(root.spanwisePanels, root.spanwiseDistribution);
    const chordFractions = panelFractions(root.chordwisePanels, root.chordwiseDistribution);
    const nodeAt = (fraction: number, chordFraction: number, side: WingMeshNode["side"]): WingMeshNode => {
      const sign = side === "right" ? 1 : -1;
      const chord = lerp(root.chord, tip.chord, fraction);
      const twist = lerp(root.twist, tip.twist, fraction) * Math.PI / 180;
      const distance = (chordFraction - 0.25) * chord;
      const local = rotateIncidence({
        x: lerp(root.xOffset, tip.xOffset, fraction) + chord / 4 + distance * Math.cos(twist),
        y: lerp(span, spanEnd, fraction) + distance * Math.sin(twist) * Math.sin(angle),
        z: lerp(height, heightEnd, fraction) - distance * Math.sin(twist) * Math.cos(angle),
      }, surface.incidence);
      return {
        x: surface.rootPosition.x + local.x,
        y: vertical ? (surface.isDoubleFin ? sign * surface.rootPosition.y : surface.rootPosition.y) - sign * local.z : surface.rootPosition.y + sign * local.y,
        z: surface.rootPosition.z + (vertical ? local.y : local.z),
        chordFraction, side,
      };
    };
    for (let spanIndex = 0; spanIndex < root.spanwisePanels; spanIndex += 1) {
      for (const side of sides) {
        const start = chordFractions.map((fraction) => nodeAt(spanFractions[spanIndex], fraction, side));
        const end = chordFractions.map((fraction) => nodeAt(spanFractions[spanIndex + 1], fraction, side));
        nodes.push(...start, ...end);
        const useRightFoil = side === "right" || surface.symmetric;
        for (let chordIndex = 0; chordIndex < root.chordwisePanels; chordIndex += 1) {
          panels.push({
            surfaceId: surface.id, side, stripIndex, chordIndex,
            airfoilRootId: useRightFoil ? root.rightAirfoilId : root.leftAirfoilId,
            airfoilTipId: useRightFoil ? tip.rightAirfoilId : tip.leftAirfoilId,
            corners: [start[chordIndex], end[chordIndex], end[chordIndex + 1], start[chordIndex + 1]],
          });
        }
      }
      stripIndex += 1;
    }
    span = spanEnd;
    height = heightEnd;
  }
  return { nodes, panels };
}

function rotateIncidence(point: AircraftPosition, degrees: number): AircraftPosition {
  const radians = degrees * Math.PI / 180;
  return { x: point.x * Math.cos(radians) + point.z * Math.sin(radians), y: point.y, z: point.z * Math.cos(radians) - point.x * Math.sin(radians) };
}

function lerp(start: number, end: number, fraction: number) { return start + (end - start) * fraction; }
