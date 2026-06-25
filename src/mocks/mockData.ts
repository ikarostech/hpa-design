import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { Airfoil, AirfoilPolar } from "../features/airfoils/model/types";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import type { Project } from "../features/projects/model/types";

const makeAirfoilCoordinates = (camber: number, thickness: number) =>
  Array.from({ length: 17 }, (_, index) => {
    const x = index / 16;
    const thicknessShape = thickness * 0.42 * Math.sin(Math.PI * x) * (1 - 0.18 * x);
    const camberLine = camber * Math.sin(Math.PI * x) * (1 - 0.28 * x);
    return {
      x,
      upper: camberLine + thicknessShape,
      lower: camberLine - thicknessShape,
    };
  });

export const projects: Project[] = [
  { id: "p1", name: "LongRange_UAV_V2", use: "UAV", updatedAt: "2026-06-21", progress: 72, status: "設計中" },
  { id: "p2", name: "HighAspect_Glider", use: "グライダー", updatedAt: "2026-06-18", progress: 88, status: "解析済み" },
  { id: "p3", name: "Sport_RC_v1", use: "RC機", updatedAt: "2026-06-12", progress: 46, status: "設計中" },
];

export const airfoils: Airfoil[] = [
  { id: "af1", name: "NACA2412", thicknessRatio: 12, maxCamber: 2, leadingEdgeRadius: 1.58, trailingEdgeThickness: 0.21, coordinates: makeAirfoilCoordinates(0.02, 0.12) },
  { id: "af2", name: "NACA4412", thicknessRatio: 12, maxCamber: 4, leadingEdgeRadius: 1.52, trailingEdgeThickness: 0.22, coordinates: makeAirfoilCoordinates(0.04, 0.12) },
  { id: "af3", name: "Clark Y", thicknessRatio: 11.7, maxCamber: 3.4, leadingEdgeRadius: 1.64, trailingEdgeThickness: 0.31, coordinates: makeAirfoilCoordinates(0.034, 0.117) },
  { id: "af4", name: "S1223", thicknessRatio: 12.1, maxCamber: 8.7, leadingEdgeRadius: 1.21, trailingEdgeThickness: 0.36, coordinates: makeAirfoilCoordinates(0.087, 0.121) },
  { id: "af5", name: "AG35", thicknessRatio: 8.7, maxCamber: 2.6, leadingEdgeRadius: 1.04, trailingEdgeThickness: 0.16, coordinates: makeAirfoilCoordinates(0.026, 0.087) },
  { id: "af6", name: "Custom_UAV_Root", thicknessRatio: 13.4, maxCamber: 3.1, leadingEdgeRadius: 1.72, trailingEdgeThickness: 0.24, coordinates: makeAirfoilCoordinates(0.031, 0.134) },
];

export const polarPoints = Array.from({ length: 17 }, (_, index) => {
  const alpha = -6 + index * 2;
  const stallLoss = alpha > 14 ? (alpha - 14) * 0.16 : 0;
  const cl = Math.max(-0.7, 0.18 + alpha * 0.095 - stallLoss);
  const cd = 0.012 + (cl - 0.25) ** 2 * 0.018;
  const cm = -0.035 - alpha * 0.0034;
  return { alpha, cl: Number(cl.toFixed(3)), cd: Number(cd.toFixed(4)), cm: Number(cm.toFixed(3)) };
});

export const airfoilPolars: AirfoilPolar[] = [
  {
    id: "pol1",
    airfoilId: "af1",
    caseName: "NACA2412_Re300k",
    reynolds: 300000,
    mach: 0.04,
    alphaRange: "-6° to 18°",
    ncrit: 9,
    converged: "17/17",
    status: "完了",
    points: polarPoints,
  },
  {
    id: "pol2",
    airfoilId: "af3",
    caseName: "ClarkY_Re250k",
    reynolds: 250000,
    mach: 0.03,
    alphaRange: "-4° to 16°",
    ncrit: 9,
    converged: "14/15",
    status: "要確認",
    points: polarPoints.map((p) => ({ ...p, cl: Number((p.cl + 0.08).toFixed(3)) })),
  },
];

export const aircraftGeometry: AircraftGeometry = {
  id: "geo1",
  projectId: "p1",
  span: 3.2,
  rootChord: 0.42,
  tipChord: 0.22,
  taperRatio: 0.52,
  twist: -2,
  dihedral: 4,
  sweep: 3,
  incidence: 1.5,
  wingArea: 1.02,
  aspectRatio: 10.1,
  mac: 0.33,
  staticMargin: 8.4,
  sections: [
    { id: "ws1", spanPosition: 0, chord: 0.42, twist: 0, dihedral: 4, airfoil: "Custom_UAV_Root", controlSurface: "なし" },
    { id: "ws2", spanPosition: 0.8, chord: 0.33, twist: -1, dihedral: 4, airfoil: "NACA2412", controlSurface: "フラップ" },
    { id: "ws3", spanPosition: 1.6, chord: 0.22, twist: -2, dihedral: 4, airfoil: "AG35", controlSurface: "エルロン" },
  ],
};

export const analysisCases: AnalysisCase[] = [
  { id: "ac1", name: "Cruise_20mps", method: "VLM", alphaSweep: "-4° to 14°", speed: 20, altitude: 120, reynolds: 420000, geometry: "LongRange_UAV_V2", status: "完了" },
  { id: "ac2", name: "Glide_BestLD", method: "LLT", alphaSweep: "-2° to 10°", speed: 14, altitude: 80, reynolds: 310000, geometry: "LongRange_UAV_V2", status: "未実行" },
  { id: "ac3", name: "Stall_Sweep", method: "VLM", alphaSweep: "0° to 20°", speed: 11, altitude: 80, reynolds: 260000, geometry: "LongRange_UAV_V2", status: "要確認" },
];

const resultRows = polarPoints.map((p) => ({
  caseName: "Cruise_20mps",
  alpha: p.alpha,
  cl: p.cl,
  cd: p.cd,
  cm: p.cm,
  ld: Number((p.cl / p.cd).toFixed(1)),
  status: "完了" as const,
}));

export const analysisResult: AnalysisResult = {
  id: "ar1",
  caseId: "ac1",
  clMax: 1.48,
  cdMin: 0.012,
  maxLD: 23.8,
  cm0: -0.04,
  status: "完了",
  rows: resultRows,
};

export const templates = [
  { name: "UAVテンプレート", description: "長航続・低速巡航向け", use: "UAV" },
  { name: "グライダーテンプレート", description: "高アスペクト比と低抵抗", use: "グライダー" },
  { name: "RC機テンプレート", description: "安定性重視のスポーツ機", use: "RC機" },
];
