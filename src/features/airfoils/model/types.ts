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
  alphaRange: string;
  ncrit: number;
  converged: string;
  status: RunStatus;
  points: Array<{ alpha: number; cl: number; cd: number; cm: number }>;
}

export type RunStatus = string;
