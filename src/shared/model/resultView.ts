export interface ResultViewState<TResultId> {
  displayedResultIds: readonly TResultId[];
  primaryResultId: TResultId | null;
  compareMode: boolean;
}

export interface ResultViewController<TResultId> {
  state: ResultViewState<TResultId>;
  show: (id: TResultId) => void;
  hide: (id: TResultId) => void;
  setPrimary: (id: TResultId) => void;
  clear: () => void;
}
