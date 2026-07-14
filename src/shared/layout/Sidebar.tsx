import { BarChart3, Download, Gauge, Home, Library, Plane, Workflow } from "lucide-react";
import { NavLink } from "react-router-dom";

export function Sidebar() {
  const navItems = [
    { label: "設計概要", path: "/", icon: Home },
    { label: "翼型", path: "/airfoils", icon: Library },
    { label: "機体設計", path: "/aircraft", icon: Plane },
    { label: "解析", path: "/analysis", icon: Workflow },
    { label: "結果", path: "/analysis?tab=results", icon: BarChart3 },
    { label: "入出力", path: "/export", icon: Download },
  ];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-3 lg:block">
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`
            }
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
