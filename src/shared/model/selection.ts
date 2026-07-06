export interface SingleSelection<TId> {
  selectedId: TId | null;
  select: (id: TId) => void;
  clear: () => void;
}

export interface MultiSelection<TId> {
  selectedIds: readonly TId[];
  isSelected: (id: TId) => boolean;
  toggle: (id: TId) => void;
  replace: (ids: readonly TId[]) => void;
  clear: () => void;
}
