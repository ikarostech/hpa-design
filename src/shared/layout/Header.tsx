import { JobStatusButton } from "../jobs/JobStatusButton";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">HPA</div>
        <p className="text-sm font-semibold text-slate-950">HPADesign</p>
      </div>
      <div className="flex items-center gap-2">
        <JobStatusButton />
      </div>
    </header>
  );
}
