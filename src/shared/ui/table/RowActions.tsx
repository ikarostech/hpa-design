import { ChevronDown, Download, Info, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button";

interface RowAction {
  onAction: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

interface DetailRowAction extends RowAction {
  active?: boolean;
}

interface CustomRowAction extends RowAction {
  key: string;
  label: string;
  icon: ReactNode;
}

interface ExportOption extends RowAction {
  key: string;
  label: string;
}

interface ExportRowAction {
  options: ExportOption[];
  disabled?: boolean;
  disabledReason?: string;
}

interface ExportMenuPosition {
  left: number;
  top: number;
}

export interface RowActionsProps {
  entityLabel: string;
  detail?: DetailRowAction;
  edit?: RowAction;
  rerun?: RowAction;
  export?: ExportRowAction;
  custom?: CustomRowAction[];
  delete?: RowAction;
}

export function RowActions({ entityLabel, detail, edit, rerun, export: exportAction, custom, delete: deleteAction }: RowActionsProps) {
  const [exportMenuPosition, setExportMenuPosition] = useState<ExportMenuPosition | null>(null);

  useEffect(() => {
    if (!exportMenuPosition) return undefined;
    const close = () => setExportMenuPosition(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [exportMenuPosition]);

  const actionLabel = (label: string) => `${entityLabel}を${label}`;
  const buttonTitle = (label: string, action: Pick<RowAction, "disabledReason">) => action.disabledReason ?? label;

  return <div className="flex items-center justify-end gap-1" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    {detail ? <Button aria-label={actionLabel("詳細表示")} title={buttonTitle("詳細", detail)} size="icon" variant={detail.active ? "primary" : "ghost"} disabled={detail.disabled} onClick={detail.onAction}><Info size={15} /></Button> : null}
    {edit ? <Button aria-label={actionLabel("編集")} title={buttonTitle("編集", edit)} size="icon" variant="ghost" disabled={edit.disabled} onClick={edit.onAction}><Pencil size={15} /></Button> : null}
    {rerun ? <Button aria-label={actionLabel("再実行")} title={buttonTitle("再実行", rerun)} size="icon" variant="ghost" disabled={rerun.disabled} onClick={rerun.onAction}><RotateCcw size={15} /></Button> : null}
    {exportAction ? <Button
      aria-label={actionLabel("出力形式から選択")}
      title={buttonTitle("出力形式を選択", exportAction)}
      aria-haspopup="menu"
      aria-expanded={exportMenuPosition !== null}
      size="sm"
      variant="ghost"
      className="gap-0 px-2"
      disabled={exportAction.disabled}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setExportMenuPosition((current) => current ? null : { left: rect.right, top: rect.top });
      }}
    ><Download size={15} /><ChevronDown size={13} /></Button> : null}
    {custom?.map((action) => <Button key={action.key} aria-label={actionLabel(action.label)} title={buttonTitle(action.label, action)} size="icon" variant="ghost" disabled={action.disabled} onClick={action.onAction}>{action.icon}</Button>)}
    {deleteAction ? <Button aria-label={actionLabel("削除")} title={buttonTitle("削除", deleteAction)} size="icon" variant="destructive" disabled={deleteAction.disabled} onClick={deleteAction.onAction}><Trash2 size={15} /></Button> : null}
    {exportMenuPosition && exportAction ? createPortal(
      <div role="menu" aria-label={actionLabel("出力形式")} className="fixed z-50 w-28 rounded-md border border-slate-200 bg-white p-1 shadow-lg" style={{ left: exportMenuPosition.left, top: exportMenuPosition.top, transform: "translate(-100%, calc(-100% - 4px))" }} onMouseDown={(event) => event.stopPropagation()}>
        {exportAction.options.map((option) => <button key={option.key} role="menuitem" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={option.disabled} title={option.disabledReason} onClick={() => { option.onAction(); setExportMenuPosition(null); }}>{option.label}</button>)}
      </div>,
      document.body,
    ) : null}
  </div>;
}
