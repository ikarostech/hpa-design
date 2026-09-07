import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { label: "翼型", path: "/aerodynamics/airfoils" },
  { label: "主翼形状", path: "/aerodynamics/geometry" },
  { label: "空力解析", path: "/aerodynamics/analysis" },
] as const;

export function AerodynamicDesignTabs() {
  const location = useLocation();

  return <nav aria-label="空力設計" role="tablist" className="flex border-b border-slate-200">
    {tabs.map((tab) => {
      const selected = location.pathname === tab.path;
      return <NavLink
        key={tab.path}
        to={tab.path}
        role="tab"
        aria-selected={selected}
        className={`px-4 py-2 text-sm font-medium ${selected ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500 hover:text-slate-900"}`}
      >{tab.label}</NavLink>;
    })}
  </nav>;
}
