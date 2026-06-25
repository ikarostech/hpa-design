export type ProjectUse = string;

export interface Project {
  id: string;
  name: string;
  use: ProjectUse;
  updatedAt: string;
  progress: number;
  status: string;
}
