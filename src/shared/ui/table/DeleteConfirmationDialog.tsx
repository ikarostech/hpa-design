import { useEffect, useId, type ReactNode } from "react";
import { Button } from "../Button";
import { Card, CardBody, CardHeader } from "../Card";

export interface DeleteConfirmationDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  blockedReason?: ReactNode;
  error?: ReactNode;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationDialog({ open, title, description, blockedReason, error, confirming = false, onConfirm, onCancel }: DeleteConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
    <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-md">
      <Card>
        <CardHeader><h2 id={titleId} className="font-semibold text-slate-950">{title}</h2></CardHeader>
        <CardBody className="space-y-4">
          <div id={descriptionId} className="text-sm text-slate-600">{description}</div>
          {blockedReason ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{blockedReason}</div> : null}
          {error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
          <div className="flex justify-end gap-2">
            <Button autoFocus variant="secondary" onClick={onCancel}>キャンセル</Button>
            <Button variant="destructive" disabled={Boolean(blockedReason) || confirming} onClick={onConfirm}>{confirming ? "削除中…" : "削除する"}</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  </div>;
}
