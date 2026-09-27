export type PanelDistribution = "uniform" | "cosine" | "sine" | "inverse-sine";

export interface WingSection {
  id: string;
  yPosition: number;
  chord: number;
  xOffset: number;
  twist: number;
  dihedral: number;
  airfoilId: string;
  chordwisePanels: number;
  spanwisePanels: number;
  chordwiseDistribution: PanelDistribution;
  spanwiseDistribution: PanelDistribution;
  /** Preserved while control-surface geometry is moved to an explicit model. */
  controlSurface?: string;
}

export type TailSurfaceOrientation = "horizontal" | "vertical";

export interface AircraftPosition {
  x: number;
  y: number;
  z: number;
}

export interface TailSurfaceSection {
  id: string;
  /** Distance from the tail root along its span axis, in metres. */
  spanPosition: number;
  chord: number;
  /** Leading-edge offset aft of the tail root reference, in metres. */
  xOffset: number;
  dihedral: number;
  twist: number;
  leftAirfoilId: string;
  rightAirfoilId: string;
  chordwisePanels: number;
  spanwisePanels: number;
  chordwiseDistribution: PanelDistribution;
  spanwiseDistribution: PanelDistribution;
}

export interface TailSurface {
  id: string;
  name: string;
  orientation: TailSurfaceOrientation;
  /** Root leading-edge position in aircraft axes, in metres. */
  rootPosition: AircraftPosition;
  incidence: number;
  /** XFLR5 `Symetric` flag. Geometry remains mirrored; this controls left/right foil symmetry. */
  symmetric: boolean;
  /** XFLR5 fin arrangement flags; valid only for vertical surfaces. */
  isDoubleFin: boolean;
  isSymmetricFin: boolean;
  sections: TailSurfaceSection[];
}

export interface AircraftGeometry {
  id: string;
  span: number;
  rootChord: number;
  tipChord: number;
  taperRatio: number;
  twist: number;
  dihedral: number;
  sweep: number;
  incidence: number;
  wingArea: number;
  aspectRatio: number;
  mac: number;
  staticMargin: number;
  sections: WingSection[];
  /** Optional for backward compatibility with projects created before tail modelling. */
  tailSurfaces?: TailSurface[];
}
