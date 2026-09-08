import { Braces, Download, Gauge, Hammer, Home, Plane, Ruler, Workflow } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

export function Sidebar() {
  const location = useLocation();
  const navItems = [
    { label: "設計概要", path: "/", icon: Home },
    { label: "概要設計", path: "/conceptual-design", icon: Ruler },
    { label: "空力設計", path: "/aerodynamics/airfoils", matchPrefix: "/aerodynamics", icon: Plane },
    { label: "構造設計", path: "/structures", icon: Hammer },
    { label: "空力・構造連成（FSI）", path: "/fsi", icon: Workflow },
    { label: "入出力", path: "/export", icon: Download },
    { label: "ファイル仕様", path: "/schema", icon: Braces },
  ];

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 self-start overflow-y-auto border-r border-slate-200 bg-white p-3 lg:block">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              isActive || (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <Gauge size={17} />
          MVP1進捗
        </div>
        <div className="mt-3 h-2 rounded-full bg-blue-100">
          <div className="h-2 w-3/4 rounded-full bg-blue-600" />
        </div>
        <p className="mt-2 text-xs leading-5 text-blue-800">翼型、機体、解析結果の導線を確認できます。</p>
      </div>
    </aside>
  );
}
