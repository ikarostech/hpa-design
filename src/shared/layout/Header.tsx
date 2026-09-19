import { Menu, X } from "lucide-react";
import { JobStatusButton } from "../jobs/JobStatusButton";
import { version } from "../../../package.json";

interface HeaderProps {
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export function Header({ mobileMenuOpen = false, onMobileMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950 lg:hidden"
          aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-controls="mobile-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={onMobileMenuToggle}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">HPA</div>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <p className="text-sm font-semibold text-slate-950">HPADesign</p>
          <span className="text-xs text-slate-500">v{version}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <JobStatusButton />
      </div>
    </header>
  );
}
