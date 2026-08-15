export function StructuralResultChart({ points, label }: { points: readonly { x: number; value: number }[]; label: string }) {
  if (!points.length) return <p className="text-sm text-slate-500">表示できるデータがありません。</p>;

  const maxX = Math.max(...points.map((point) => point.x), 1);
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || 1;
  const polyline = points
    .map((point) => `${40 + point.x / maxX * 720},${190 - (point.value - min) / range * 150}`)
    .join(" ");

  return <div>
    <svg viewBox="0 0 800 220" className="h-64 w-full" role="img" aria-label={label}>
      <line x1="40" y1="190" x2="760" y2="190" stroke="#cbd5e1" />
      <line x1="40" y1="40" x2="40" y2="190" stroke="#cbd5e1" />
      <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="3" />
      <text x="45" y="30" fontSize="12" fill="#64748b">max {formatStructuralNumber(max, 3)}</text>
      <text x="760" y="208" textAnchor="end" fontSize="12" fill="#64748b">Y {maxX.toFixed(2)} m</text>
    </svg>
  </div>;
}

export function formatStructuralNumber(value: number, digits: number) {
  return Number.isFinite(value) ? value.toFixed(digits) : "∞";
}
