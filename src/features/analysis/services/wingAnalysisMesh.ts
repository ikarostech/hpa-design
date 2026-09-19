import type { PanelDistribution, WingSection } from "../../aircraft/model/types";
import { deriveWingGeometry } from "../../aircraft/model/wingGeometry";

export interface WingMeshNode {
  x: number;
  y: number;
  z: number;
  chordFraction: number;
  side: "left" | "right";
}

export interface WingMeshPanel {
  side: "left" | "right";
  stripIndex: number;
  chordIndex: number;
  airfoilRootId: string;
  airfoilTipId: string;
  corners: readonly [WingMeshNode, WingMeshNode, WingMeshNode, WingMeshNode];
}

export interface WingMeshStrip {
  yStart: number;
  yEnd: number;
  centerY: number;
  chord: number;
  twist: number; // degrees
  quarterChordSweep: number; // degrees
  dihedral: number; // degrees
  halfArea: number;
  airfoilRootId: string;
  airfoilTipId: string;
  airfoilInterpolation: number;
}

export interface WingAnalysisMesh {
  nodes: WingMeshNode[];
  panels: WingMeshPanel[];
  strips: WingMeshStrip[];
}

export function createWingAnalysisMesh(sections: readonly WingSection[]): WingAnalysisMesh {
  const positioned = deriveWingGeometry(sections).sectionPositions;
  const nodes: WingMeshNode[] = [];
  const panels: WingMeshPanel[] = [];
  const strips: WingMeshStrip[] = [];
  let stripIndex = 0;

  for (let sectionIndex = 0; sectionIndex < positioned.length - 1; sectionIndex += 1) {
    const root = positioned[sectionIndex];
    const tip = positioned[sectionIndex + 1];
    const yPanels = clampPanelCount(root.spanwisePanels);
    const xPanels = clampPanelCount(root.chordwisePanels);
    const spanFractions = panelFractions(yPanels, root.spanwiseDistribution);
    const chordFractions = panelFractions(xPanels, root.chordwiseDistribution);

    for (let yIndex = 0; yIndex < yPanels; yIndex += 1) {
      const spanStart = spanFractions[yIndex];
      const spanEnd = spanFractions[yIndex + 1];
      const spanMid = (spanStart + spanEnd) / 2;
      const yStart = interpolate(root.yPosition, tip.yPosition, spanStart);
      const yEnd = interpolate(root.yPosition, tip.yPosition, spanEnd);
      const chordStart = interpolate(root.chord, tip.chord, spanStart);
      const chordEnd = interpolate(root.chord, tip.chord, spanEnd);
      const quarterChordStart = interpolate(root.xOffset + root.chord / 4, tip.xOffset + tip.chord / 4, spanStart);
      const quarterChordEnd = interpolate(root.xOffset + root.chord / 4, tip.xOffset + tip.chord / 4, spanEnd);
      const zStart = interpolate(root.zPosition, tip.zPosition, spanStart);
      const zEnd = interpolate(root.zPosition, tip.zPosition, spanEnd);

      strips.push({
        yStart,
        yEnd,
        centerY: (yStart + yEnd) / 2,
        chord: interpolate(root.chord, tip.chord, spanMid),
        twist: interpolate(root.twist, tip.twist, spanMid),
        quarterChordSweep: Math.atan2(quarterChordEnd - quarterChordStart, yEnd - yStart) * 180 / Math.PI,
        dihedral: Math.atan2(zEnd - zStart, yEnd - yStart) * 180 / Math.PI,
        halfArea: (yEnd - yStart) * (chordStart + chordEnd) / 2,
        airfoilRootId: root.airfoilId,
        airfoilTipId: tip.airfoilId,
        airfoilInterpolation: spanMid,
      });

      for (const side of ["right", "left"] as const) {
        const startNodes = chordFractions.map((chordFraction) => createNode(root, tip, spanStart, chordFraction, side));
        const endNodes = chordFractions.map((chordFraction) => createNode(root, tip, spanEnd, chordFraction, side));
        nodes.push(...startNodes, ...endNodes);
        for (let chordIndex = 0; chordIndex < xPanels; chordIndex += 1) {
          panels.push({
            side,
            stripIndex,
            chordIndex,
            airfoilRootId: root.airfoilId,
            airfoilTipId: tip.airfoilId,
            corners: [startNodes[chordIndex], endNodes[chordIndex], endNodes[chordIndex + 1], startNodes[chordIndex + 1]],
          });
        }
      }
      stripIndex += 1;
    }
  }

  return { nodes, panels, strips };
}

function createNode(
  root: ReturnType<typeof deriveWingGeometry>["sectionPositions"][number],
  tip: ReturnType<typeof deriveWingGeometry>["sectionPositions"][number],
  spanFraction: number,
  chordFraction: number,
  side: "left" | "right",
): WingMeshNode {
  const yPosition = interpolate(root.yPosition, tip.yPosition, spanFraction);
  const chord = interpolate(root.chord, tip.chord, spanFraction);
  const xOffset = interpolate(root.xOffset, tip.xOffset, spanFraction);
  const zPosition = interpolate(root.zPosition, tip.zPosition, spanFraction);
  const twist = interpolate(root.twist, tip.twist, spanFraction) * Math.PI / 180;
  const quarterChord = xOffset + chord / 4;
  const distanceFromQuarterChord = (chordFraction - 0.25) * chord;
  return {
    x: quarterChord + distanceFromQuarterChord * Math.cos(twist),
    y: side === "right" ? yPosition : -yPosition,
    z: zPosition - distanceFromQuarterChord * Math.sin(twist),
    chordFraction,
    side,
  };
}

function panelFractions(panelCount: number, distribution: PanelDistribution) {
  return Array.from({ length: panelCount + 1 }, (_, index) => distributionFraction(index / panelCount, distribution));
}

function distributionFraction(value: number, distribution: PanelDistribution) {
  switch (distribution) {
    case "cosine": return (1 - Math.cos(Math.PI * value)) / 2;
    case "sine": return Math.sin(Math.PI * value / 2);
    case "inverse-sine": return 1 - Math.sin(Math.PI * (1 - value) / 2);
    default: return value;
  }
}

function clampPanelCount(value: number) {
  return Math.max(1, Math.min(200, Math.round(value)));
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}
