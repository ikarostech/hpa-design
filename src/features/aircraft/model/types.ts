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
}
