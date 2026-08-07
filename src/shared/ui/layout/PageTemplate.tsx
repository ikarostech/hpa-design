import type { ReactNode } from "react";

interface PageTemplateProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  notices?: ReactNode;
  children: ReactNode;
}

export function PageTemplate({ title, description, actions, tabs, notices, children }: PageTemplateProps) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {tabs}
      {notices}
      {children}
    </div>
  );
}
