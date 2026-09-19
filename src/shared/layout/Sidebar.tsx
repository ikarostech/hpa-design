import { Download, Hammer, Home, Plane, Ruler, Workflow } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

interface SidebarProps {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function Sidebar({ variant = "desktop", onNavigate }: SidebarProps) {
  const location = useLocation();
  const navItems = [
    { label: "設計概要", path: "/", icon: Home },
    { label: "概要設計", path: "/conceptual-design", icon: Ruler },
    { label: "空力設計", path: "/aerodynamics/airfoils", matchPrefix: "/aerodynamics", icon: Plane },
    { label: "構造設計", path: "/structures", icon: Hammer },
    { label: "空力・構造連成（FSI）", path: "/fsi", icon: Workflow },
    { label: "入出力", path: "/export", icon: Download },
  ];

  return (
    <aside className={variant === "desktop"
      ? "sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 self-start overflow-y-auto border-r border-slate-200 bg-white p-3 lg:block"
      : "h-full w-72 overflow-y-auto border-r border-slate-200 bg-white p-3 shadow-xl"}>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              isActive || (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
