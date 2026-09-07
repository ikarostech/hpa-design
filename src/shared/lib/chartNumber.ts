export function formatChartNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";

  const rounded = Math.abs(value) < 0.005 ? 0 : Number(value.toFixed(2));
  return String(rounded);
}

export function formatChartValue(value: unknown): string {
  if (typeof value === "number") return formatChartNumber(value);
  if (Array.isArray(value)) return value.map(formatChartValue).join(" – ");
  return value == null ? "" : String(value);
}
