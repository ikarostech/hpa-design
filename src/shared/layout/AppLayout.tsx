import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header mobileMenuOpen={mobileMenuOpen} onMobileMenuToggle={() => setMobileMenuOpen((open) => !open)} />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
      {mobileMenuOpen && (
        <div id="mobile-navigation" role="dialog" aria-modal="true" aria-label="メインメニュー" className="fixed inset-x-0 bottom-0 top-16 z-30 flex lg:hidden">
          <div className="relative z-10 h-full">
            <Sidebar variant="mobile" onNavigate={() => setMobileMenuOpen(false)} />
          </div>
          <button type="button" aria-label="メニューを閉じる" className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
