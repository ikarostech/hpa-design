import { cn } from "@/shared/lib/utils";
import type { AircraftGeometry } from "../model/types";
import styles from "./AircraftPreview.module.css";

export function AircraftPreview({ lift = false, geometry }: { lift?: boolean; geometry?: AircraftGeometry }) {
  const halfSpan = geometry ? Math.min(310, Math.max(130, geometry.span * 90)) : 290;
  const rootHalfChord = geometry ? Math.min(36, Math.max(16, geometry.rootChord * 70 / 2)) : 26;
  const tipHalfChord = geometry ? Math.min(28, Math.max(8, geometry.tipChord * 70 / 2)) : 16;
  const wingPath = `M -${halfSpan} -${tipHalfChord} L ${halfSpan} -${tipHalfChord} L ${halfSpan - 36} ${tipHalfChord} L -${halfSpan - 36} ${tipHalfChord} Z`;
  return (
    <svg viewBox="0 0 760 420" className={styles.preview}>
      <defs>
        <pattern id="preview-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M 36 0 L 0 0 0 36" className={styles.gridLine} />
        </pattern>
        <linearGradient id="wing-lift" x1="0" x2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="760" height="420" fill="url(#preview-grid)" />
      <g transform="translate(380 210)">
        <path d="M -44 -130 L 44 -130 L 32 128 L -32 128 Z" className={styles.fuselage} />
        <path d={wingPath} transform={`scale(1 ${rootHalfChord / Math.max(tipHalfChord, 1)})`} className={cn(styles.wing, lift && styles.liftWing)} />
        <path d="M -100 120 L 100 120 L 76 150 L -76 150 Z" className={styles.tail} />
        <path d="M 28 84 L 86 162 L 42 162 L 12 96 Z" className={styles.fin} />
        <path d={`M -${halfSpan} 0 L ${halfSpan} 0`} className={styles.centerLine} />
        {lift ? (
          <g opacity="0.8">
            {[-210, -140, -70, 0, 70, 140, 210].map((x, index) => (
              <path
                key={x}
                d={`M ${x} -28 C ${x - 24} -70, ${x + 24} -92, ${x} -132`}
                className={cn(styles.liftTrail, index < 3 ? styles.liftTrailPrimary : styles.liftTrailSecondary)}
              />
            ))}
          </g>
        ) : null}
      </g>
      <text x="24" y="38" className={styles.label}>Geometry Preview</text>
      <text x="24" y="62" className={styles.subLabel}>{geometry ? `Span ${geometry.span.toFixed(2)} m / Root chord ${geometry.rootChord.toFixed(2)} m` : "簡易形状ビュー"}</text>
    </svg>
  );
}
