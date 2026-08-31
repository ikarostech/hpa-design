import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import {
  calculateConceptualDesignMetrics,
  conceptualDesignConditions,
  validateConceptualDesign,
  type ConceptualDesign,
} from "../features/conceptual-design/model/conceptualDesign";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

interface ConceptualDesignPageProps {
  conceptualDesign: ConceptualDesign;
  aircraft: Pick<AircraftGeometry, "span" | "wingArea">;
  onSave: (conceptualDesign: ConceptualDesign) => void;
}

const fields: Array<{ key: keyof ConceptualDesign; label: string; unit: string; step: number; help: string }> = [
  { key: "grossMass", label: "設計総重量", unit: "kg", step: 1, help: "パイロットと機体を含む飛行時の総質量" },
  { key: "cruiseSpeed", label: "設計巡航速度", unit: "m/s", step: 0.1, help: "定常水平飛行で基準にする速度" },
  { key: "maximumWingspan", label: "翼幅上限", unit: "m", step: 0.1, help: "運用・製作上許容する最大翼幅" },
  { key: "groundHeight", label: "目標飛行高度", unit: "m", step: 0.1, help: "地面効果の基準となる翼の地上高" },
  { key: "sustainablePower", label: "パイロット継続出力", unit: "W", step: 5, help: "巡航中に継続して利用できる軸出力" },
];

export function ConceptualDesignPage({ conceptualDesign, aircraft, onSave }: ConceptualDesignPageProps) {
  const [draft, setDraft] = useState(conceptualDesign);
  useEffect(() => setDraft(conceptualDesign), [conceptualDesign]);

  const validation = validateConceptualDesign(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(conceptualDesign);
  const metrics = useMemo(
    () => validation.valid ? calculateConceptualDesignMetrics(draft, aircraft) : null,
    [aircraft, draft, validation.valid],
  );

  return (
    <PageTemplate
      title="概要設計"
      description="飛行機全体の基準条件を先に定め、翼型・機体・構造設計の出発点として使用します。"
      actions={<>
        <Button variant="secondary" disabled={!dirty} onClick={() => setDraft(conceptualDesign)}>キャンセル</Button>
        <Button disabled={!dirty || !validation.valid} onClick={() => validation.valid && onSave(draft)}><Save size={16} />保存</Button>
      </>}
      notices={!validation.valid ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">0より大きい値を入力してから保存してください。</div> : undefined}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-950">設計要求</h2>
            <p className="mt-1 text-sm text-slate-500">後工程で共通して参照する最小限の目標値です。</p>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => <NumberField
              key={field.key}
              label={field.label}
              unit={field.unit}
              step={field.step}
              help={field.help}
              value={draft[field.key]}
              error={!validation.valid ? validation.errors[field.key] : undefined}
              onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            />)}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-950">固定条件</h2>
            <p className="mt-1 text-sm text-slate-500">今回の人力飛行機設計で共通使用します。</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <ReadValue label="大気条件" value={`海抜 ${conceptualDesignConditions.altitude} m / ${conceptualDesignConditions.temperature} ℃`} />
            <ReadValue label="水平飛行荷重倍数" value={conceptualDesignConditions.loadFactor.toFixed(1)} />
            <ReadValue label="構造安全率" value={conceptualDesignConditions.safetyFactor.toFixed(1)} />
            <p className="text-xs leading-5 text-slate-500">目標飛行高度は大気高度ではなく、地面効果を評価する翼の地上高です。</p>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="derived-metrics-title">
        <div className="mb-3">
          <h2 id="derived-metrics-title" className="font-semibold text-slate-950">現在の機体による参考値</h2>
          <p className="mt-1 text-sm text-slate-500">機体設計の翼幅 {aircraft.span.toFixed(2)} m、翼面積 {aircraft.wingArea.toFixed(2)} m²を使用しています。</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="設計重量" value={metrics ? `${metrics.weight.toFixed(1)} N` : "—"} detail="総重量から換算" />
          <MetricCard label="必要揚力係数" value={metrics ? metrics.requiredLiftCoefficient.toFixed(3) : "—"} detail="巡航時の水平飛行" />
          <MetricCard label="h/b" value={metrics ? metrics.heightToSpanRatio.toFixed(4) : "—"} detail="翼地上高 / 現在の翼幅" />
          <MetricCard label="翼幅余裕" value={metrics ? `${metrics.wingspanMargin.toFixed(2)} m` : "—"} detail="上限 − 現在の翼幅" />
          <MetricCard label="翼面荷重" value={metrics ? `${metrics.wingLoading.toFixed(1)} N/m²` : "—"} detail="現在の翼面積" />
          <MetricCard label="動圧" value={metrics ? `${metrics.dynamicPressure.toFixed(1)} Pa` : "—"} detail="巡航速度・30 ℃" />
          <MetricCard label="空気密度" value={metrics ? `${metrics.airDensity.toFixed(3)} kg/m³` : "—"} detail="海抜0 m・30 ℃" />
          <MetricCard label="パワー荷重" value={metrics ? `${metrics.powerLoading.toFixed(2)} N/W` : "—"} detail="重量 / 継続出力" />
        </div>
      </section>
    </PageTemplate>
  );
}

function NumberField({ label, unit, step, help, value, error, onChange }: { label: string; unit: string; step: number; help: string; value: number; error?: string; onChange: (value: number) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<span className="relative mt-1 block"><input aria-label={label} aria-invalid={Boolean(error)} type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-md border border-slate-200 px-3 py-2 pr-14 text-sm outline-none focus:border-blue-400" /><span className="absolute right-3 top-2 text-sm text-slate-400">{unit}</span></span><span className={`mt-1 block text-xs ${error ? "text-red-700" : "text-slate-500"}`}>{error ?? help}</span></label>;
}

function ReadValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
}
