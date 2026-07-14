export interface Airfoil {
  id: string;
  name: string;
  thicknessRatio: number;
  maxCamber: number;
  leadingEdgeRadius: number;
  trailingEdgeThickness: number;
  coordinates: Array<{ x: number; upper: number; lower: number }>;
}

export interface AirfoilPolar {
  id: string;
  airfoilId: string;
  caseName: string;
  reynolds: number;
  mach: number;
  alphaStart: number;
  alphaEnd: number;
  alphaStep: number;
  ncrit: number;
  convergedPoints: number;
  requestedPoints: number;
  status: PolarStatus;
  points: Array<{ alpha: number; cl: number; cd: number; cm: number }>;
}

export interface AirfoilAnalysisRun {
  id: string;
  name: string;
  airfoilIds: string[];
  polarIds: string[];
  createdAt: string;
  reynolds: number;
  mach: number;
  alphaStart: number;
  alphaEnd: number;
  alphaStep: number;
  status: AirfoilAnalysisRunStatus;
}

export type PolarStatus = "complete" | "needs-review";
export type AirfoilAnalysisRunStatus = "complete" | "needs-review";
