import { Bell, CircleHelp, Search } from "lucide-react";
import { JobStatusButton } from "../jobs/JobStatusButton";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">HPA</div>
        <div>
          <p className="text-sm font-semibold text-slate-950">HPADesign</p>
          <p className="text-xs text-slate-500">Aero workspace MVP1</p>
        </div>
      </div>
      <div className="mx-6 hidden w-full max-w-xl items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
        <Search size={17} className="text-slate-400" />
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder="検索（プロジェクト、翼型、解析など）"
        />
      </div>
      <div className="flex items-center gap-2">
        <JobStatusButton />
        <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="ヘルプ">
          <CircleHelp size={19} />
        </button>
        <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" title="通知">
          <Bell size={19} />
        </button>
        <div className="ml-1 hidden items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 sm:flex">
          <div className="h-7 w-7 rounded-full bg-emerald-100 text-center text-sm font-semibold leading-7 text-emerald-700">IK</div>
          <span className="text-sm font-medium text-slate-700">Ikaro</span>
        </div>
      </div>
    </header>
  );
}
