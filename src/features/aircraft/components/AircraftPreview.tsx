import { cn } from "@/shared/lib/utils";
import type { KeyboardEvent } from "react";
import type { AircraftGeometry, PanelDistribution, WingSection } from "../model/types";
import { deriveWingGeometry } from "../model/wingGeometry";
import styles from "./AircraftPreview.module.css";

interface AircraftPreviewProps {
  lift?: boolean;
  geometry?: AircraftGeometry;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
}

export function AircraftPreview({ lift = false, geometry, selectedSectionId = null, onSelectSection }: AircraftPreviewProps) {
  const sections = geometry?.sections ?? [];
  if (!geometry || sections.length < 2) {
    return <div className={styles.empty}>翼形状を表示するには2つ以上の断面が必要です。</div>;
  }

  const metrics = deriveWingGeometry(sections);
  const sorted = metrics.sectionPositions;
  const semiSpan = Math.max(sorted[sorted.length - 1].yPosition, 0.001);
  const minX = Math.min(...sorted.map((section) => section.xOffset));
  const maxX = Math.max(...sorted.map((section) => section.xOffset + section.chord));
  const xRange = Math.max(maxX - minX, 0.001);
  const planScale = Math.min(320 / semiSpan, 150 / xRange);
  const planMidX = (minX + maxX) / 2;
  const planX = (yPosition: number, side: -1 | 1 = 1) => 380 + side * yPosition * planScale;
  const planY = (xPosition: number) => 111 + (xPosition - planMidX) * planScale;
  const frontZRange = Math.max(...sorted.map((section) => Math.abs(section.zPosition)), 0.001);
  const frontScale = Math.min(planScale, 65 / frontZRange);
  const frontX = (yPosition: number, side: -1 | 1 = 1) => 380 + side * yPosition * frontScale;
  const frontY = (zPosition: number) => 350 - zPosition * frontScale;
  const rightPlanform = planformPath(sorted, 1, planX, planY);
  const leftPlanform = planformPath(sorted, -1, planX, planY);
  const frontRight = polylinePath(sorted.map((section) => [frontX(section.yPosition), frontY(section.zPosition)]));
  const frontLeft = polylinePath(sorted.map((section) => [frontX(section.yPosition, -1), frontY(section.zPosition)]));
  const meshLines = createMeshLines(sorted, planX, planY);

  const selectSection = (sectionId: string) => onSelectSection?.(sectionId);
  const selectWithKeyboard = (event: KeyboardEvent<SVGGElement>, sectionId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectSection(sectionId);
    }
  };

  return (
    <svg viewBox="0 0 760 420" className={styles.preview} aria-label="主翼形状プレビュー">
      <defs>
        <pattern id="preview-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" className={styles.gridLine} /></pattern>
        <linearGradient id="wing-lift" x1="0" x2="1"><stop offset="0%" stopColor="#22c55e" /><stop offset="50%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#2563eb" /></linearGradient>
      </defs>
      <rect width="760" height="420" fill="url(#preview-grid)" />

      <text x="20" y="25" className={styles.label}>上面図</text>
      <path d={rightPlanform} className={cn(styles.wing, lift && styles.liftWing)} />
      <path d={leftPlanform} className={cn(styles.wing, lift && styles.liftWing)} />
      <path d="M 380 30 L 380 200" className={styles.centerLine} />

      {meshLines.map((line) => <path key={line.key} data-testid="mesh-line" d={line.path} className={styles.meshLine} />)}

      {sorted.map((section, index) => {
        const quarterChordY = planY(section.xOffset + section.chord / 4);
        const selected = section.id === selectedSectionId;
        return <g key={section.id}>
          <path data-testid="planform-section" d={`M ${planX(section.yPosition)} ${planY(section.xOffset)} L ${planX(section.yPosition)} ${planY(section.xOffset + section.chord)}`} className={cn(styles.sectionLine, selected && styles.selectedLine)} />
          {section.yPosition > 0 ? <path d={`M ${planX(section.yPosition, -1)} ${planY(section.xOffset)} L ${planX(section.yPosition, -1)} ${planY(section.xOffset + section.chord)}`} className={cn(styles.sectionLine, selected && styles.selectedLine)} /> : null}
          <g role="button" tabIndex={0} aria-label={`上面図のSection ${index + 1}を選択`} aria-current={selected ? "true" : undefined} onClick={() => selectSection(section.id)} onKeyDown={(event) => selectWithKeyboard(event, section.id)} className={styles.sectionHandle}>
            <circle cx={planX(section.yPosition)} cy={quarterChordY} r={12} className={styles.hitTarget} />
            <circle cx={planX(section.yPosition)} cy={quarterChordY} r={selected ? 6 : 4} className={cn(styles.sectionPoint, selected && styles.selectedPoint)} />
          </g>
        </g>;
      })}

      <text x="20" y="238" className={styles.label}>正面図</text>
      <path d="M 44 350 L 716 350" className={styles.axisLine} />
      <path d={frontRight} className={styles.frontLine} />
      <path d={frontLeft} className={styles.frontLine} />
      {sorted.map((section, index) => {
        const selected = section.id === selectedSectionId;
        const x = frontX(section.yPosition);
        const y = frontY(section.zPosition);
        return <g key={section.id} role="button" tabIndex={0} aria-label={`正面図のSection ${index + 1}を選択`} aria-current={selected ? "true" : undefined} onClick={() => selectSection(section.id)} onKeyDown={(event) => selectWithKeyboard(event, section.id)} className={styles.sectionHandle}>
          <circle cx={x} cy={y} r={12} className={styles.hitTarget} />
          <circle data-testid="front-section" cx={x} cy={y} r={selected ? 5 : 3} className={cn(styles.sectionPoint, selected && styles.selectedPoint)} />
        </g>;
      })}

      <text x="20" y="400" className={styles.subLabel}>Span {metrics.span.toFixed(3)} m / Area {metrics.wingArea.toFixed(3)} m² / 1/4 chord sweep {metrics.sweep.toFixed(2)}°</text>
    </svg>
  );
}

interface MeshLine {
  key: string;
  path: string;
}

function createMeshLines(
  sections: readonly WingSection[],
  planX: (yPosition: number, side?: -1 | 1) => number,
  planY: (xPosition: number) => number,
) {
  const lines: MeshLine[] = [];
  const chordwisePanels = Math.min(50, Math.max(1, sections[0].chordwisePanels));
  for (let panelIndex = 1; panelIndex < chordwisePanels; panelIndex += 1) {
    const fraction = distributionFraction(panelIndex / chordwisePanels, sections[0].chordwiseDistribution);
    for (const side of [1, -1] as const) {
      lines.push({
        key: `x-${side}-${panelIndex}`,
        path: polylinePath(sections.map((section) => [planX(section.yPosition, side), planY(section.xOffset + section.chord * fraction)])),
      });
    }
  }

  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
    const root = sections[sectionIndex];
    const tip = sections[sectionIndex + 1];
    const spanwisePanels = Math.min(50, Math.max(1, root.spanwisePanels));
    for (let panelIndex = 1; panelIndex < spanwisePanels; panelIndex += 1) {
      const fraction = distributionFraction(panelIndex / spanwisePanels, root.spanwiseDistribution);
      const yPosition = interpolate(root.yPosition, tip.yPosition, fraction);
      const xOffset = interpolate(root.xOffset, tip.xOffset, fraction);
      const chord = interpolate(root.chord, tip.chord, fraction);
      for (const side of [1, -1] as const) {
        lines.push({ key: `y-${sectionIndex}-${side}-${panelIndex}`, path: `M ${planX(yPosition, side)} ${planY(xOffset)} L ${planX(yPosition, side)} ${planY(xOffset + chord)}` });
      }
    }
  }
  return lines;
}

function distributionFraction(value: number, distribution: PanelDistribution) {
  switch (distribution) {
    case "cosine": return (1 - Math.cos(Math.PI * value)) / 2;
    case "sine": return Math.sin(Math.PI * value / 2);
    case "inverse-sine": return 1 - Math.sin(Math.PI * (1 - value) / 2);
    default: return value;
  }
}

function planformPath(sections: readonly WingSection[], side: -1 | 1, planX: (value: number, side?: -1 | 1) => number, planY: (value: number) => number) {
  const points = [
    ...sections.map((section) => [planX(section.yPosition, side), planY(section.xOffset)] as const),
    ...[...sections].reverse().map((section) => [planX(section.yPosition, side), planY(section.xOffset + section.chord)] as const),
  ];
  return `${polylinePath(points)} Z`;
}

function polylinePath(points: readonly (readonly number[])[]) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}
