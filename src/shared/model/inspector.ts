export type InspectorMode = "detail" | "create" | "edit";

export interface InspectorState<TId> {
  open: boolean;
  mode: InspectorMode;
  targetId: TId | null;
}

export interface InspectorController<TId> {
  state: InspectorState<TId>;
  openDetail: (id: TId) => void;
  openCreate: () => void;
  openEdit: (id: TId) => void;
  close: () => void;
}
