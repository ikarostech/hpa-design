import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import type { Airfoil, AirfoilPolar } from "../model/types";
import type { XfoilAnalysisSettings } from "../model/xfoilAnalysis";
import { Button } from "../../../shared/ui/Button";
import { AirfoilTargetTable } from "./AirfoilTargetTable";

interface AirfoilAnalysisDrawerProps {
  open: boolean;
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  selectedForAnalysisIds: string[];
  targetNames: string[];
  isRunning: boolean;
  error: string | null;
  onClose: () => void;
  onToggleAnalysisTarget: (airfoilId: string) => void;
  onRun: (settings: XfoilAnalysisSettings) => void;
}

export function AirfoilAnalysisDrawer({
  open,
  airfoils,
  airfoilPolars,
  selectedForAnalysisIds,
  targetNames,
  isRunning,
  error,
  onClose,
  onToggleAnalysisTarget,
  onRun,
}: AirfoilAnalysisDrawerProps) {
  const [settings, setSettings] = useState<XfoilAnalysisSettings>({
    reynolds: 300000,
    mach: 0.04,
    alphaStart: -6,
    alphaEnd: 18,
    alphaStep: 2,
    ncrit: 9,
    iterations: 100,
  });

  if (!open) {
    return null;
  }

  const update = (key: keyof XfoilAnalysisSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
  };

  const canRun = targetNames.length > 0 && !isRunning;

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/10" aria-label="解析作成を閉じる" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full flex-col border-l bg-white shadow-xl sm:max-w-[440px]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="一覧に戻る" onClick={onClose}>
              <ArrowLeft size={18} />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-950">2D翼型解析を作成</h2>
              <p className="mt-1 text-sm text-slate-500">翼型リストで選択した対象を一括解析します。</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="解析作成を閉じる" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="rounded-md border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">解析対象</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{targetNames.length > 0 ? targetNames.join(", ") : "翼型リストから選択"}</p>
          </div>
          <div className="rounded-md border border-slate-200">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">翼型リスト</p>
              <p className="mt-1 text-xs text-slate-500">この解析で実行する翼型を選択します。</p>
            </div>
            <AirfoilTargetTable
              airfoils={airfoils}
              airfoilPolars={airfoilPolars}
              selectedForAnalysisIds={selectedForAnalysisIds}
              minWidth="min-w-[520px]"
              onToggleAnalysisTarget={onToggleAnalysisTarget}
            />
          </div>
          <Input label="Re数" value={settings.reynolds} onChange={(value) => update("reynolds", value)} />
          <Input label="Mach数" value={settings.mach} step="0.01" onChange={(value) => update("mach", value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input label="α開始" value={settings.alphaStart} onChange={(value) => update("alphaStart", value)} />
            <Input label="α終了" value={settings.alphaEnd} onChange={(value) => update("alphaEnd", value)} />
            <Input label="刻み" value={settings.alphaStep} onChange={(value) => update("alphaStep", value)} />
          </div>
          <Input label="Ncrit" value={settings.ncrit} onChange={(value) => update("ncrit", value)} />
          <Input label="反復回数" value={settings.iterations} onChange={(value) => update("iterations", value)} />
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button onClick={() => onRun(settings)} disabled={!canRun}>
            <CheckCircle2 size={16} />
            {isRunning ? "XFOIL実行中" : `${targetNames.length}件を一括解析`}
          </Button>
        </div>
      </aside>
    </div>
  );
}

function Input({ label, value, step = "1", onChange }: { label: string; value: number; step?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input type="number" step={step} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
