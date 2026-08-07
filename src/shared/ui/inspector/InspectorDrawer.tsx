import { ArrowLeft, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../Button";

interface InspectorDrawerProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  backLabel?: string;
  width?: "standard" | "wide";
  onClose: () => void;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function InspectorDrawer({
  open,
  title,
  subtitle,
  closeLabel,
  backLabel,
  width = "standard",
  onClose,
  headerActions,
  footer,
  children,
}: InspectorDrawerProps) {
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/10"
        aria-label={`${closeLabel.replace(/を閉じる$/, "")}の背景を閉じる`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l bg-white shadow-xl",
          width === "wide" ? "sm:max-w-[520px]" : "sm:max-w-[440px]",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {backLabel ? <Button variant="ghost" size="icon" aria-label={backLabel} onClick={onClose}><ArrowLeft size={18} /></Button> : null}
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-semibold text-slate-950">{title}</h2>
              {subtitle ? <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <Button variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose}><X size={18} /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <div className="border-t p-4">{footer}</div> : null}
      </aside>
    </div>
  );
}
