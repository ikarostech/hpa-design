export type SortDirection = "asc" | "desc";

export interface TableState<TSortKey extends string> {
  sortKey: TSortKey | null;
  sortDirection: SortDirection;
  filterText: string;
  pageIndex: number;
  pageSize: number;
}

export interface TableController<TSortKey extends string> {
  state: TableState<TSortKey>;
  setSort: (key: TSortKey) => void;
  setFilterText: (value: string) => void;
  setPage: (pageIndex: number) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
}
