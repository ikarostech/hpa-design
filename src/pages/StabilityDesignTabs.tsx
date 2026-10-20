import { NavLink, useLocation } from "react-router-dom";

export function StabilityDesignTabs() {
  const { pathname } = useLocation();
  return <nav aria-label="安定性設計" role="tablist" className="flex border-b border-slate-200">
    {[
      { label: "尾翼設計", path: "/stability/tails" },
      { label: "安定性解析", path: "/stability" },
    ].map(({ label, path }) => <NavLink key={path} to={path} role="tab" aria-selected={pathname === path}
      className={`px-4 py-2 text-sm font-medium ${pathname === path ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500 hover:text-slate-900"}`}>
      {label}
    </NavLink>)}
  </nav>;
}
