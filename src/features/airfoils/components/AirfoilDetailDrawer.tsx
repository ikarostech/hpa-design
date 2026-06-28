import { X } from "lucide-react";
import type { Airfoil } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { AirfoilPlot } from "./AirfoilPlot";

interface AirfoilDetailDrawerProps {
  airfoil: Airfoil;
  open: boolean;
  polarReady: boolean;
  onClose: () => void;
}

export function AirfoilDetailDrawer({ airfoil, open, polarReady, onClose }: AirfoilDetailDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-slate-950/30" aria-label="詳細を閉じる" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{airfoil.name}</h2>
            <p className="mt-1 text-sm text-slate-500">翼型形状と基本パラメータ</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="詳細を閉じる" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <AirfoilPlot airfoil={airfoil} className="h-48 min-h-0" />
          <div className="grid gap-3 sm:grid-cols-2">
            <DataBox label="厚み比" value={`${airfoil.thicknessRatio}%`} />
            <DataBox label="最大キャンバー" value={`${airfoil.maxCamber}%`} />
            <DataBox label="LE半径" value={`${airfoil.leadingEdgeRadius}%`} />
            <DataBox label="TE厚" value={`${airfoil.trailingEdgeThickness}%`} />
          </div>
          {polarReady ? <Badge tone="green">Polar作成済み</Badge> : <Badge tone="amber">未作成</Badge>}
        </div>
      </aside>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>;
}
