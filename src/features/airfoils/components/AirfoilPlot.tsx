import type { Airfoil } from "../model/types";
import { cn } from "../../../shared/lib/utils";

interface AirfoilPlotProps {
  airfoil: Airfoil;
  className?: string;
}

const toPoint = (x: number, y: number) => `${40 + x * 500},${135 - y * 760}`;

export function AirfoilPlot({ airfoil, className }: AirfoilPlotProps) {
  const upper = airfoil.coordinates.map((p) => toPoint(p.x, p.upper)).join(" ");
  const lower = [...airfoil.coordinates].reverse().map((p) => toPoint(p.x, p.lower)).join(" ");

  return (
    <svg viewBox="0 0 580 250" className={cn("h-full min-h-64 w-full rounded-lg bg-slate-50", className)}>
      <defs>
        <pattern id="airfoil-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="580" height="250" fill="url(#airfoil-grid)" />
      <line x1="40" y1="135" x2="540" y2="135" stroke="#94a3b8" strokeWidth="1" />
      <line x1="40" y1="40" x2="40" y2="210" stroke="#94a3b8" strokeWidth="1" />
      <polygon points={`${upper} ${lower}`} fill="#dbeafe" stroke="#2563eb" strokeWidth="3" />
      <polyline points={upper} fill="none" stroke="#1d4ed8" strokeWidth="3" />
      <polyline points={lower} fill="none" stroke="#38bdf8" strokeWidth="3" />
      <text x="505" y="155" fill="#475569" fontSize="12">x/c</text>
      <text x="18" y="48" fill="#475569" fontSize="12">y/c</text>
      <text x="40" y="226" fill="#64748b" fontSize="12">0.0</text>
      <text x="520" y="226" fill="#64748b" fontSize="12">1.0</text>
    </svg>
  );
}
