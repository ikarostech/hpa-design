import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { XfoilAnalysisSettings } from "../model/xfoilAnalysis";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilAnalysisSettingsCardProps {
  polarReady: boolean;
  airfoilName: string;
  isRunning: boolean;
  error: string | null;
  onRun: (settings: XfoilAnalysisSettings) => void;
}

export function AirfoilAnalysisSettingsCard({ polarReady, airfoilName, isRunning, error, onRun }: AirfoilAnalysisSettingsCardProps) {
  const [settings, setSettings] = useState<XfoilAnalysisSettings>({
    reynolds: 300000,
    mach: 0.04,
    alphaStart: -6,
    alphaEnd: 18,
    alphaStep: 2,
    ncrit: 9,
    iterations: 100,
  });

  const update = (key: keyof XfoilAnalysisSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">2D翼型解析</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="rounded-md border border-slate-200 px-3 py-2">
          <p className="text-xs text-slate-500">解析対象</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{airfoilName}</p>
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
        <Button className="w-full" variant={polarReady ? "success" : "primary"} onClick={() => onRun(settings)} disabled={isRunning}>
          <CheckCircle2 size={16} />
          {isRunning ? "XFOIL実行中" : "XFOILでPolar作成"}
        </Button>
      </CardBody>
    </Card>
  );
}

function Input({ label, value, step = "1", onChange }: { label: string; value: number; step?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input type="number" step={step} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
