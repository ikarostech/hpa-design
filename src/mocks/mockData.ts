import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { Airfoil, AirfoilPolar } from "../features/airfoils/model/types";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";

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
    alphaStart: -6,
    alphaEnd: 18,
    alphaStep: 2,
    ncrit: 9,
    convergedPoints: 17,
    requestedPoints: 17,
    status: "complete",
    points: polarPoints,
  },
  {
    id: "pol2",
    airfoilId: "af3",
    caseName: "ClarkY_Re250k",
    reynolds: 250000,
    mach: 0.03,
    alphaStart: -4,
    alphaEnd: 16,
    alphaStep: 2,
    ncrit: 9,
    convergedPoints: 14,
    requestedPoints: 15,
    status: "needs-review",
    points: polarPoints.map((p) => ({ ...p, cl: Number((p.cl + 0.08).toFixed(3)) })),
  },
];

export const aircraftGeometry: AircraftGeometry = {
  id: "geo1",
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
    { id: "ws1", yPosition: 0, chord: 0.42, xOffset: 0, twist: 0, dihedral: 4, airfoilId: "af6", chordwisePanels: 12, spanwisePanels: 8, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform", controlSurface: "none" },
    { id: "ws2", yPosition: 0.8, chord: 0.33, xOffset: 0.042, twist: -1, dihedral: 4, airfoilId: "af1", chordwisePanels: 12, spanwisePanels: 8, chordwiseDistribution: "cosine", spanwiseDistribution: "cosine", controlSurface: "flap" },
    { id: "ws3", yPosition: 1.6, chord: 0.22, xOffset: 0.084, twist: -2, dihedral: 0, airfoilId: "af5", chordwisePanels: 12, spanwisePanels: 1, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform", controlSurface: "aileron" },
  ],
};

export const analysisCases: AnalysisCase[] = [
  { id: "ac1", name: "Cruise_20mps", method: "VLM", alphaStart: -4, alphaEnd: 14, alphaStep: 2, speed: 20, altitude: 120, reynolds: 420000, geometryId: "geo1", status: "completed" },
  { id: "ac2", name: "Glide_BestLD", method: "LLT", alphaStart: -2, alphaEnd: 10, alphaStep: 2, speed: 14, altitude: 80, reynolds: 310000, geometryId: "geo1", status: "not-run" },
  { id: "ac3", name: "Stall_Sweep", method: "VLM", alphaStart: 0, alphaEnd: 20, alphaStep: 2, speed: 11, altitude: 80, reynolds: 260000, geometryId: "geo1", status: "needs-review" },
];

const resultRows = polarPoints.map((p) => ({
  caseId: "ac1",
  alpha: p.alpha,
  cl: p.cl,
  cd: p.cd,
  cm: p.cm,
  ld: Number((p.cl / p.cd).toFixed(1)),
  status: "completed" as const,
}));

export const analysisResult: AnalysisResult = {
  id: "ar1",
  caseId: "ac1",
  clMax: 1.48,
  cdMin: 0.012,
  maxLD: 23.8,
  cm0: -0.04,
  status: "completed",
  rows: resultRows,
};

export const templates = [
  { name: "UAVテンプレート", description: "長航続・低速巡航向け", use: "UAV" },
  { name: "グライダーテンプレート", description: "高アスペクト比と低抵抗", use: "グライダー" },
  { name: "RC機テンプレート", description: "安定性重視のスポーツ機", use: "RC機" },
];
