import { AlertTriangle, ChevronRight, Save } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AircraftPreview } from "../features/aircraft/components/AircraftPreview";
import { WingSectionTable } from "../features/aircraft/components/WingSectionTable";
import { aircraftGeometry } from "../mocks/mockData";
import type { FormController } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";

const tabs = ["概要", "翼・尾翼設計", "胴体設計", "配置・重量", "制御・サーフェス", "干渉チェック"];

const initialAircraftForm = {
  span: aircraftGeometry.span,
  rootChord: aircraftGeometry.rootChord,
  tipChord: aircraftGeometry.tipChord,
  taperRatio: aircraftGeometry.taperRatio,
  twist: aircraftGeometry.twist,
  dihedral: aircraftGeometry.dihedral,
  sweep: aircraftGeometry.sweep,
  incidence: aircraftGeometry.incidence,
  airfoil: "NACA2412",
  aileron: "外翼 35%",
};

type AircraftFormState = typeof initialAircraftForm;

export function AircraftWorkspacePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<AircraftFormState>(initialAircraftForm);

  const formController: FormController<AircraftFormState> = {
    state: {
      value: form,
      initialValue: initialAircraftForm,
      errors: {},
      dirty: !isSameAircraftForm(form, initialAircraftForm),
      valid: true,
      submitting: false,
    },
    update: (key, value) => setForm((current) => ({ ...current, [key]: value })),
    patch: (value) => setForm((current) => ({ ...current, ...value })),
    reset: (value = initialAircraftForm) => setForm(value),
    submit: async () => undefined,
  };

  const update = <TKey extends keyof AircraftFormState>(key: TKey, value: string) => {
    const currentValue = formController.state.value[key];
    const nextValue = typeof currentValue === "number" ? Number(value) : value;
    formController.update(key, nextValue as AircraftFormState[TKey]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">機体ワークスペース</h1>
          <p className="mt-1 text-sm text-slate-500">主翼・尾翼・重量配置を定義し、解析に渡すジオメトリを整えます。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary"><Save size={16} />保存</Button>
          <Button onClick={() => navigate("/analysis")}>解析に進む<ChevronRight size={16} /></Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => (
          <button key={tab} className={`whitespace-nowrap px-3 py-2 text-sm font-medium ${tab === "翼・尾翼設計" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[240px_1fr_340px]">
        <Card>
          <CardHeader><h2 className="font-semibold text-slate-950">コンポーネントツリー</h2></CardHeader>
          <CardBody className="space-y-2 text-sm">
            {["主翼", "  左翼", "  右翼", "水平尾翼", "垂直尾翼", "胴体", "翼型割り当て"].map((item) => (
              <button key={item} className={`block w-full rounded-md px-3 py-2 text-left ${item.trim() === "主翼" ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                {item}
              </button>
            ))}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-950">3Dプレビュー</h2>
              <Badge tone="blue">簡易表示</Badge>
            </CardHeader>
            <CardBody>
              <AircraftPreview />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">主翼セクション</h2></CardHeader>
            <CardBody>
              <WingSectionTable sections={aircraftGeometry.sections} />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold text-slate-950">主翼プロパティ</h2></CardHeader>
          <CardBody className="space-y-3">
            <NumberInput label="スパン" value={formController.state.value.span} onChange={(value) => update("span", value)} />
            <NumberInput label="ルート弦長" value={formController.state.value.rootChord} onChange={(value) => update("rootChord", value)} />
            <NumberInput label="チップ弦長" value={formController.state.value.tipChord} onChange={(value) => update("tipChord", value)} />
            <NumberInput label="テーパー比" value={formController.state.value.taperRatio} onChange={(value) => update("taperRatio", value)} />
            <NumberInput label="ねじり角" value={formController.state.value.twist} onChange={(value) => update("twist", value)} />
            <NumberInput label="上反角" value={formController.state.value.dihedral} onChange={(value) => update("dihedral", value)} />
            <NumberInput label="後退角" value={formController.state.value.sweep} onChange={(value) => update("sweep", value)} />
            <NumberInput label="取り付け角" value={formController.state.value.incidence} onChange={(value) => update("incidence", value)} />
            <SelectInput label="翼型割り当て" value={formController.state.value.airfoil} onChange={(value) => update("airfoil", value)} options={["NACA2412", "Custom_UAV_Root", "AG35"]} />
            <SelectInput label="エルロン設定" value={formController.state.value.aileron} onChange={(value) => update("aileron", value)} options={["外翼 35%", "外翼 45%", "なし"]} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="翼面積" value={`${aircraftGeometry.wingArea.toFixed(2)} m²`} />
        <MetricCard label="アスペクト比" value={aircraftGeometry.aspectRatio.toFixed(1)} />
        <MetricCard label="MAC" value={`${aircraftGeometry.mac.toFixed(2)} m`} />
        <MetricCard label="静安定マージン" value={`${aircraftGeometry.staticMargin.toFixed(1)}%`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-amber-900">
          <AlertTriangle size={18} />
          <span>Polar未作成の翼型があります / 重心未設定</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/airfoils")}>Polarへ移動</Button>
          <Button variant="secondary">重心を設定</Button>
        </div>
      </div>
    </div>
  );
}

function isSameAircraftForm(left: AircraftFormState, right: AircraftFormState) {
  return Object.keys(left).every((key) => left[key as keyof AircraftFormState] === right[key as keyof AircraftFormState]);
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}
