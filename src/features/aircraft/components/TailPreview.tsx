import { useId, useMemo } from "react";
import type { AircraftGeometry, AircraftPosition } from "../model/types";
import { createAircraftAnalysisMesh, createTailAnalysisMesh, type AircraftAnalysisMesh } from "../model/aircraftMesh";
import { DEFAULT_SPAR_CHORD_FRACTION, DEFAULT_WING_SPAR_CHORD_FRACTION } from "../model/sparGeometry";

type Projection = (point: AircraftPosition) => { x: number; y: number };

export function TailPreview({ aircraft }: { aircraft: AircraftGeometry }) {
  const gridId = useId();
  const { surfaces, invalid } = useMemo(() => {
    const wing = createAircraftAnalysisMesh({ ...aircraft, tailSurfaces: [] });
    const surfaces = [{ id: aircraft.id, name: "主翼", wing: true, spar: aircraft.sparChordFraction ?? DEFAULT_WING_SPAR_CHORD_FRACTION, mesh: wing }];
    const invalid: string[] = [];
    for (const surface of aircraft.tailSurfaces ?? []) {
      try {
        surfaces.push({ id: surface.id, name: surface.name, wing: false, spar: surface.sparChordFraction ?? DEFAULT_SPAR_CHORD_FRACTION, mesh: createTailAnalysisMesh(surface) });
      } catch {
        invalid.push(surface.name);
      }
    }
    return { surfaces, invalid };
  }, [aircraft]);
  const nodes = surfaces.flatMap((surface) => surface.mesh.nodes);
  if (!nodes.length) return <div role="img" aria-label="尾翼配置プレビュー" className="grid min-h-72 place-items-center rounded-md bg-slate-950 text-sm text-slate-400">有効な主翼・尾翼形状を入力すると、ここに配置が表示されます。</div>;
  const top = fitProjection(nodes, (point) => ({ x: point.y, y: point.x }), 35, 200);
  const side = fitProjection(nodes, (point) => ({ x: point.x, y: -point.z }), 255, 395);
  return <div>
    <svg role="img" aria-label="尾翼配置プレビュー" viewBox="0 0 760 420" className="min-h-72 w-full rounded-md bg-slate-950"
      data-top-scale={top.scale} data-top-offset-x={top.offsetX} data-top-offset-y={top.offsetY}
      data-side-scale={side.scale} data-side-offset-x={side.offsetX} data-side-offset-y={side.offsetY}>
      <defs><pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#334155" strokeWidth="1" /></pattern></defs>
      <rect width="760" height="420" fill={`url(#${gridId})`} />
      <text x="20" y="25" fill="#cbd5e1" fontSize="13" fontWeight="600">上面図</text>
      <text x="20" y="240" fill="#cbd5e1" fontSize="13" fontWeight="600">側面図</text>
      <path d={`M ${top.offsetX} 35 L ${top.offsetX} 200`} stroke="#64748b" strokeDasharray="5 5" />
      <path d={`M 20 ${side.offsetY} L 740 ${side.offsetY}`} stroke="#64748b" strokeDasharray="5 5" />
      {surfaces.map((surface) => <g key={surface.id}>
        {(["top", "side"] as const).map((view) => <g key={view} data-testid={surface.wing && view === "side" ? "main-wing-side" : undefined}>
          {outlines(surface.mesh).map(({ side: half, leading, trailing }) => {
            const project = view === "top" ? top.project : side.project;
            const outline = [...leading, ...trailing.toReversed()];
            const spar = leading.map((point, index) => interpolate(point, trailing[index], surface.spar));
            return <g key={half}>
              <polygon data-testid={surface.wing ? view === "top" ? "main-wing-planform" : undefined : `tail-${view}-planform`}
                points={outline.map((point) => coordinates(project(point))).join(" ")}
                fill={surface.wing ? "#f59e0b33" : "#2563eb66"} stroke={surface.wing ? "#fbbf24" : "#60a5fa"} strokeWidth="1.5" />
              <path data-testid={view === "top" || !surface.wing ? surface.wing ? "main-wing-spar" : "tail-spar" : undefined}
                d={spar.map((point, index) => `${index ? "L" : "M"} ${coordinates(project(point))}`).join(" ")}
                fill="none" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="5 3" />
            </g>;
          })}
          {!surface.wing && surface.mesh.nodes[0] ? (() => {
            const position = (view === "top" ? top.project : side.project)(surface.mesh.nodes[0]);
            return <text x={position.x + 5} y={Math.max(view === "top" ? 35 : 255, position.y - 5)} fill="#e2e8f0" fontSize="11">{surface.name}</text>;
          })() : null}
        </g>)}
      </g>)}
      <g aria-label="凡例">
        <rect x="570" y="12" width="12" height="8" fill="#f59e0b33" stroke="#fbbf24" /><text x="588" y="20" fill="#fde68a" fontSize="11">主翼</text>
        <rect x="630" y="12" width="12" height="8" fill="#2563eb66" stroke="#60a5fa" /><text x="648" y="20" fill="#bfdbfe" fontSize="11">尾翼</text>
        <path d="M 690 16 L 702 16" stroke="#fcd34d" strokeDasharray="5 3" /><text x="708" y="20" fill="#fde68a" fontSize="11">桁</text>
      </g>
    </svg>
    {invalid.length ? <p role="status" className="mt-2 text-sm text-amber-800">入力が不正な尾翼は表示していません: {invalid.join("、")}</p> : null}
  </div>;
}

function outlines(mesh: AircraftAnalysisMesh) {
  return (["right", "left"] as const).flatMap((side) => {
    const nodes = mesh.nodes.filter((point) => point.side === side);
    const leading = nodes.filter((point) => point.chordFraction === 0);
    const trailing = nodes.filter((point) => point.chordFraction === 1);
    return leading.length ? [{ side, leading, trailing }] : [];
  });
}

function fitProjection(nodes: AircraftPosition[], axes: Projection, minimumY: number, maximumY: number) {
  let minX = 0; let maxX = 0; let minY = 0; let maxY = 0;
  for (const node of nodes) {
    const point = axes(node);
    minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
  }
  const scale = Math.min(700 / Math.max(maxX - minX, 1), (maximumY - minimumY - 10) / Math.max(maxY - minY, 1));
  const offsetX = 380 - (minX + maxX) * scale / 2;
  const offsetY = (minimumY + maximumY) / 2 - (minY + maxY) * scale / 2;
  return { scale, offsetX, offsetY, project: (point: AircraftPosition) => {
    const position = axes(point);
    return { x: offsetX + position.x * scale, y: offsetY + position.y * scale };
  } };
}

function interpolate(a: AircraftPosition, b: AircraftPosition, fraction: number): AircraftPosition {
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, z: a.z + (b.z - a.z) * fraction };
}
function coordinates(point: { x: number; y: number }) { return `${point.x},${point.y}`; }
