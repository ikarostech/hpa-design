export interface WingSection {
  id: string;
  spanPosition: number;
  chord: number;
  twist: number;
  dihedral: number;
  airfoil: string;
  controlSurface: string;
}

export interface AircraftGeometry {
  id: string;
  projectId: string;
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
