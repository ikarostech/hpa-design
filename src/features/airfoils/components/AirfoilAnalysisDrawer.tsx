import { ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormController, MultiSelection } from "@/shared/model";
import type { Airfoil, AirfoilPolar } from "../model/types";
import type { AirfoilAnalysisJobController } from "../model/workspace";
import type { XfoilAnalysisSettings } from "../model/analysis";
import { validateXfoilAnalysisSettings } from "../model/analysisValidation";
import { Button } from "../../../shared/ui/Button";
import { AirfoilTargetTable } from "./AirfoilTargetTable";

const defaultAnalysisSettings: XfoilAnalysisSettings = {
  reynolds: 300000,
  mach: 0.04,
  alphaStart: -6,
  alphaEnd: 18,
  alphaStep: 2,
  ncrit: 9,
  iterations: 100,
};

interface AirfoilAnalysisDrawerProps {
  open: boolean;
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  analysisTargets: MultiSelection<string>;
  targetNames: string[];
  jobController: AirfoilAnalysisJobController;
  initialSettings?: XfoilAnalysisSettings;
  onClose: () => void;
}

export function AirfoilAnalysisDrawer({
  open,
  airfoils,
  airfoilPolars,
  analysisTargets,
  targetNames,
  jobController,
  initialSettings,
  onClose,
}: AirfoilAnalysisDrawerProps) {
  const [settings, setSettings] = useState<XfoilAnalysisSettings>(defaultAnalysisSettings);
  useEffect(() => { if (open && initialSettings) setSettings(initialSettings); }, [initialSettings, open]);

  const currentJob = jobController.currentJob;
  const isRunning = currentJob?.status === "running";
  const progress = currentJob?.progress ?? null;
  const error = currentJob?.status === "failed" ? currentJob.errorMessage : null;
  const validation = validateXfoilAnalysisSettings(settings);
  const canRun = targetNames.length > 0 && validation.valid && !isRunning;
  const progressPercent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const settingsForm: FormController<XfoilAnalysisSettings> = {
    state: {
      value: settings,
      initialValue: defaultAnalysisSettings,
      errors: validation.valid ? {} : validation.errors,
      dirty: settings !== defaultAnalysisSettings,
      valid: validation.valid,
      submitting: isRunning,
    },
    update: (key, value) => setSettings((current) => ({ ...current, [key]: value })),
    patch: (value) => setSettings((current) => ({ ...current, ...value })),
    reset: (value = defaultAnalysisSettings) => setSettings(value),
    submit: async () => {
      if (canRun) {
        await jobController.run(settings);
      }
    },
  };

  if (!open) {
    return null;
  }

  const update = (key: keyof XfoilAnalysisSettings, value: string) => {
    settingsForm.update(key, Number(value));
  };

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
              analysisTargets={analysisTargets}
              minWidth="min-w-[520px]"
            />
          </div>
          <Input label="Re数" value={settingsForm.state.value.reynolds} error={settingsForm.state.errors.reynolds} onChange={(value) => update("reynolds", value)} />
          <Input label="Mach数" value={settingsForm.state.value.mach} error={settingsForm.state.errors.mach} step="0.01" onChange={(value) => update("mach", value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input label="α開始" value={settingsForm.state.value.alphaStart} error={settingsForm.state.errors.alphaStart} onChange={(value) => update("alphaStart", value)} />
            <Input label="α終了" value={settingsForm.state.value.alphaEnd} onChange={(value) => update("alphaEnd", value)} />
            <Input label="刻み" value={settingsForm.state.value.alphaStep} error={settingsForm.state.errors.alphaStep} onChange={(value) => update("alphaStep", value)} />
          </div>
          <Input label="Ncrit" value={settingsForm.state.value.ncrit} error={settingsForm.state.errors.ncrit} onChange={(value) => update("ncrit", value)} />
          <Input label="反復回数" value={settingsForm.state.value.iterations} error={settingsForm.state.errors.iterations} onChange={(value) => update("iterations", value)} />
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="space-y-3 border-t p-4">
          {isRunning && progress ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>XFOIL実行中</span>
                <span>{progress.completed}/{progress.total}件・{progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>キャンセル</Button>
            {isRunning && currentJob ? <Button variant="destructive" aria-label="解析をキャンセル" onClick={() => void jobController.cancel(currentJob.id)}>解析をキャンセル</Button> : null}
            <Button onClick={settingsForm.submit} disabled={!canRun}>
              <CheckCircle2 size={16} />
              {isRunning ? `XFOIL実行中 ${progressPercent}%` : `${targetNames.length}件を一括解析`}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Input({ label, value, error, step = "1", onChange }: { label: string; value: number; error?: string; step?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input aria-invalid={Boolean(error)} type="number" step={step} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} />{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</label>;
}
