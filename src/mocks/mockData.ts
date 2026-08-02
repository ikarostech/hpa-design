import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { Airfoil, AirfoilPolar } from "../features/airfoils/model/types";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import type { CarbonMaterial, StructuralDesign } from "../features/structures/model/types";

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

export const carbonMaterials: CarbonMaterial[] = [{
  id: "carbon-t700-ud",
  name: "T700 UD（設計値）",
  e1: 125e9,
  e2: 8.5e9,
  g12: 4.5e9,
  nu12: 0.3,
  tensileStrength1: 1500e6,
  compressiveStrength1: 800e6,
  tensileStrength2: 45e6,
  compressiveStrength2: 150e6,
  shearStrength12: 70e6,
  density: 1550,
  plyThickness: 0.000125,
  reductionFactor: 0.8,
  note: "初期検討用の代表値。実材料の試験値へ置換してください。",
}];

export const structuralDesigns: StructuralDesign[] = [{
  id: "main-spar-1",
  name: "主翼メインパイプ",
  sections: [
    { id: "spar-root", length: 0.4, outerDiameter: 0.08, plies: [{ id: "root-0", materialId: "carbon-t700-ud", angle: 0, count: 8 }, { id: "root-45p", materialId: "carbon-t700-ud", angle: 45, count: 1 }, { id: "root-45m", materialId: "carbon-t700-ud", angle: -45, count: 1 }] },
    { id: "spar-mid", length: 0.8, outerDiameter: 0.065, plies: [{ id: "mid-0", materialId: "carbon-t700-ud", angle: 0, count: 6 }, { id: "mid-45p", materialId: "carbon-t700-ud", angle: 45, count: 1 }, { id: "mid-45m", materialId: "carbon-t700-ud", angle: -45, count: 1 }] },
    { id: "spar-tip", length: 0.4, outerDiameter: 0.04, plies: [{ id: "tip-0", materialId: "carbon-t700-ud", angle: 0, count: 4 }, { id: "tip-45p", materialId: "carbon-t700-ud", angle: 45, count: 1 }, { id: "tip-45m", materialId: "carbon-t700-ud", angle: -45, count: 1 }] },
  ],
  loadCases: [{
    id: "structure-load-cruise",
    name: "巡航楕円荷重",
    source: "elliptical",
    loadFactor: 1,
    safetyFactor: 1.5,
    distributedLoads: [
      { yPosition: 0, liftPerLength: 240, torquePerLength: 3 },
      { yPosition: 0.8, liftPerLength: 208, torquePerLength: 2 },
      { yPosition: 1.6, liftPerLength: 0, torquePerLength: 0 },
    ],
    pointLoads: [],
    status: "not-run",
  }],
}];

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
