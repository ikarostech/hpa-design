import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "../Button";
import { Card, CardBody, CardHeader } from "../Card";
import { TableActionCell, TableActionHeader } from "./TableActionColumn";

export interface OrderedTableColumn<TItem> {
  key: string;
  header: ReactNode;
  renderCell: (item: TItem, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface OrderedTableInsertAction {
  onAction: (selectedKey: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export interface OrderedEntityTableProps<TItem> {
  title: string;
  description?: string;
  itemLabel: string;
  items: readonly TItem[];
  columns: readonly OrderedTableColumn<TItem>[];
  getKey: (item: TItem) => string;
  getRowLabel: (item: TItem, index: number) => string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  insertBefore: OrderedTableInsertAction;
  insertAfter: OrderedTableInsertAction;
  renderActions?: (item: TItem, index: number) => ReactNode;
  minWidthClassName?: string;
  emptyState?: ReactNode;
  footer?: ReactNode;
}

export function OrderedEntityTable<TItem>({
  title,
  description,
  itemLabel,
  items,
  columns,
  getKey,
  getRowLabel,
  selectedKey,
  onSelect,
  insertBefore,
  insertAfter,
  renderActions,
  minWidthClassName,
  emptyState,
  footer,
}: OrderedEntityTableProps<TItem>) {
  const selectionMissing = selectedKey === null;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={selectionMissing || insertBefore.disabled}
            title={insertBefore.disabledReason}
            onClick={() => selectedKey && insertBefore.onAction(selectedKey)}
          ><Plus size={15} />前に{itemLabel}を追加</Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selectionMissing || insertAfter.disabled}
            title={insertAfter.disabledReason}
            onClick={() => selectedKey && insertAfter.onAction(selectedKey)}
          ><Plus size={15} />後ろに{itemLabel}を追加</Button>
        </div>
      </CardHeader>
      <CardBody>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className={cn("w-full text-left text-sm", minWidthClassName)}>
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  {columns.map((column) => <th key={column.key} scope="col" className={cn("p-2 font-semibold", column.headerClassName)}>{column.header}</th>)}
                  {renderActions ? <TableActionHeader className="font-semibold" /> : null}
                </tr>
              </thead>
              <tbody>{items.map((item, index) => {
                const key = getKey(item);
                const selected = key === selectedKey;
                return <tr key={key} aria-label={getRowLabel(item, index)} aria-selected={selected} onClick={() => onSelect(key)} className={cn("border-b border-slate-100 align-top", selected && "bg-blue-50/70")}>
                  {columns.map((column) => <td key={column.key} className={cn("p-2", column.cellClassName)}>{column.renderCell(item, index)}</td>)}
                  {renderActions ? <TableActionCell>{renderActions(item, index)}</TableActionCell> : null}
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : emptyState ?? <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{itemLabel}がありません。</div>}
        {footer}
      </CardBody>
    </Card>
  );
}
