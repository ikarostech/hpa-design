import type { AircraftGeometry, TailSurface, WingSection } from "../model/types";

export function TailPreview({ aircraft }: { aircraft: AircraftGeometry }) {
  const surfaces = aircraft.tailSurfaces ?? [];
  const wingSections = [...aircraft.sections].sort((left, right) => left.yPosition - right.yPosition);
  if (!surfaces.length && wingSections.length < 2) {
    return <div role="img" aria-label="尾翼配置プレビュー" className="grid min-h-72 place-items-center rounded-md bg-slate-950 text-sm text-slate-400">尾翼を追加すると、ここに配置が表示されます。</div>;
  }

  const maximumX = Math.max(
    aircraft.rootChord,
    ...wingSections.map((section) => section.xOffset + section.chord),
    ...surfaces.flatMap((surface) => surface.sections.map((section) => surface.rootPosition.x + section.xOffset + section.chord)),
  );
  const minimumX = Math.min(
    0,
    ...wingSections.map((section) => section.xOffset),
    ...surfaces.flatMap((surface) => surface.sections.map((section) => surface.rootPosition.x + section.xOffset)),
  );
  const wingSemiSpan = Math.max(0, ...wingSections.map((section) => section.yPosition));
  const horizontalSpan = Math.max(aircraft.span / 2, wingSemiSpan, ...surfaces.filter((surface) => surface.orientation === "horizontal").map(surfaceSemiSpan), 1);
  const verticalExtent = Math.max(...surfaces.filter((surface) => surface.orientation === "vertical").map((surface) => surface.rootPosition.z + surfaceSemiSpan(surface)), 1);
  const topScale = Math.min(650 / (2 * horizontalSpan), 150 / Math.max(maximumX - minimumX, 1));
  const sideScale = Math.min(650 / Math.max(maximumX - minimumX, 1), 80 / verticalExtent);
  const sideStart = 380 - (maximumX - minimumX) * sideScale / 2;
  const topSpan = (value: number) => 380 + value * topScale;
  const topLongitudinal = (value: number) => 35 + (value - minimumX) * topScale;
  const sideX = (value: number) => sideStart + (value - minimumX) * sideScale;

  return <svg role="img" aria-label="尾翼配置プレビュー" viewBox="0 0 760 360" className="min-h-72 w-full rounded-md bg-slate-950">
    <defs><pattern id="tail-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#334155" strokeWidth="1" /></pattern></defs>
    <rect width="760" height="360" fill="url(#tail-grid)" />
    <text x="20" y="25" fill="#cbd5e1" fontSize="13" fontWeight="600">上面図</text>
    <path d={`M ${topSpan(0)} 32 L ${topSpan(0)} 195`} stroke="#64748b" strokeDasharray="5 5" />
    {wingSections.length >= 2 ? ([1, -1] as const).map((side) => <polygon data-testid="main-wing-planform" key={`main-wing-${side}`} points={wingPlanformPoints(wingSections, (span) => topSpan(side * span), topLongitudinal)} fill="#f59e0b33" stroke="#fbbf24" strokeWidth="1.5" />) : null}
    {surfaces.filter((surface) => surface.orientation === "horizontal").flatMap((surface) => ([1, -1] as const).map((side) => <polygon key={`${surface.id}-${side}`} points={planformPoints(surface, topLongitudinal, (span) => topSpan(side * span))} fill="#2563eb66" stroke="#60a5fa" strokeWidth="1.5" />))}

    <text x="20" y="240" fill="#cbd5e1" fontSize="13" fontWeight="600">側面図</text>
    <path d={`M ${sideX(minimumX)} 325 L ${sideX(maximumX)} 325`} stroke="#64748b" strokeDasharray="5 5" />
    {wingSections.length >= 2 ? <path data-testid="main-wing-side" d={wingSidePath(wingSections, sideX)} fill="#f59e0b33" stroke="#fbbf24" strokeWidth="1.5" /> : null}
    {surfaces.filter((surface) => surface.orientation === "vertical").map((surface) => <polygon key={surface.id} points={sidePlanformPoints(surface, sideX, (span) => 325 - (surface.rootPosition.z + span) * sideScale)} fill="#0d948866" stroke="#2dd4bf" strokeWidth="1.5" />)}
    {surfaces.map((surface) => <text key={`${surface.id}-label`} x={surface.orientation === "horizontal" ? topSpan(surfaceSemiSpan(surface) * 0.2) : sideX(surface.rootPosition.x)} y={surface.orientation === "horizontal" ? Math.max(32, topLongitudinal(surface.rootPosition.x) - 5) : 255} fill="#e2e8f0" fontSize="11">{surface.name}</text>)}
    <g aria-label="凡例">
      <rect x="590" y="12" width="12" height="8" fill="#f59e0b33" stroke="#fbbf24" />
      <text x="608" y="20" fill="#fde68a" fontSize="11">主翼</text>
      <rect x="650" y="12" width="12" height="8" fill="#2563eb66" stroke="#60a5fa" />
      <text x="668" y="20" fill="#bfdbfe" fontSize="11">尾翼</text>
    </g>
  </svg>;
}

function surfaceSemiSpan(surface: TailSurface) {
  return Math.max(0, ...surface.sections.map((section) => section.spanPosition));
}

function planformPoints(surface: TailSurface, longitudinalAxis: (value: number) => number, spanAxis: (value: number) => number) {
  const sections = [...surface.sections].sort((left, right) => left.spanPosition - right.spanPosition);
  const points = [
    ...sections.map((section) => `${spanAxis(section.spanPosition)},${longitudinalAxis(surface.rootPosition.x + section.xOffset)}`),
    ...sections.reverse().map((section) => `${spanAxis(section.spanPosition)},${longitudinalAxis(surface.rootPosition.x + section.xOffset + section.chord)}`),
  ];
  return points.join(" ");
}

function sidePlanformPoints(surface: TailSurface, longitudinalAxis: (value: number) => number, spanAxis: (value: number) => number) {
  const sections = [...surface.sections].sort((left, right) => left.spanPosition - right.spanPosition);
  return [
    ...sections.map((section) => `${longitudinalAxis(surface.rootPosition.x + section.xOffset)},${spanAxis(section.spanPosition)}`),
    ...sections.reverse().map((section) => `${longitudinalAxis(surface.rootPosition.x + section.xOffset + section.chord)},${spanAxis(section.spanPosition)}`),
  ].join(" ");
}

function wingPlanformPoints(sections: readonly WingSection[], spanAxis: (value: number) => number, longitudinalAxis: (value: number) => number) {
  return [
    ...sections.map((section) => `${spanAxis(section.yPosition)},${longitudinalAxis(section.xOffset)}`),
    ...[...sections].reverse().map((section) => `${spanAxis(section.yPosition)},${longitudinalAxis(section.xOffset + section.chord)}`),
  ].join(" ");
}

function wingSidePath(sections: readonly WingSection[], x: (value: number) => number) {
  const root = sections.reduce((closest, section) => section.yPosition < closest.yPosition ? section : closest);
  return `M ${x(root.xOffset)} 322 L ${x(root.xOffset + root.chord)} 322 L ${x(root.xOffset + root.chord)} 328 L ${x(root.xOffset)} 328 Z`;
}
