import { ArrowLeft, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormController } from "@/shared/model";
import type { Airfoil } from "../model/types";
import type { AirfoilEditorMode } from "../model/workspace";
import { Button } from "../../../shared/ui/Button";
import { AirfoilPlot } from "./AirfoilPlot";

interface AirfoilEditorDrawerProps {
  mode: AirfoilEditorMode | null;
  airfoil?: Airfoil;
  open: boolean;
  onClose: () => void;
  onSave: (airfoil: Airfoil) => void;
}

interface AirfoilFormState {
  name: string;
  nacaCode: string;
  thicknessRatio: number;
  maxCamber: number;
  leadingEdgeRadius: number;
  trailingEdgeThickness: number;
  datText: string;
}

const defaultForm: AirfoilFormState = {
  name: "NACA0012",
  nacaCode: "0012",
  thicknessRatio: 12,
  maxCamber: 0,
  leadingEdgeRadius: 1.5,
  trailingEdgeThickness: 0.2,
  datText: "",
};

export function AirfoilEditorDrawer({ mode, airfoil, open, onClose, onSave }: AirfoilEditorDrawerProps) {
  const [form, setForm] = useState<AirfoilFormState>(defaultForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && airfoil) {
      setForm({
        name: airfoil.name,
        nacaCode: "",
        thicknessRatio: airfoil.thicknessRatio,
        maxCamber: airfoil.maxCamber,
        leadingEdgeRadius: airfoil.leadingEdgeRadius,
        trailingEdgeThickness: airfoil.trailingEdgeThickness,
        datText: "",
      });
      return;
    }

    if (mode === "import-dat") {
      setForm({ ...defaultForm, name: "Imported_Airfoil", datText: "Imported_Airfoil\n1.000000 0.000000\n0.500000 0.060000\n0.000000 0.000000\n0.500000 -0.040000\n1.000000 0.000000" });
      return;
    }

    setForm(defaultForm);
  }, [airfoil, mode, open]);

  if (!open || !mode) {
    return null;
  }

  const title = mode === "edit" ? "翼型を編集" : mode === "import-dat" ? ".datから作成" : "NACA翼型を作成";
  const previewAirfoil = buildPreviewAirfoil(mode, airfoil?.id, form);

  const formController: FormController<AirfoilFormState> = {
    state: {
      value: form,
      initialValue: defaultForm,
      errors: {},
      dirty: !isSameForm(form, defaultForm),
      valid: true,
      submitting: false,
    },
    update: (key, value) => setForm((current) => ({ ...current, [key]: value })),
    patch: (value) => setForm((current) => ({ ...current, ...value })),
    reset: (value = defaultForm) => setForm(value),
    submit: async () => {
      onSave(previewAirfoil);
    },
  };

  const update = (key: keyof AirfoilFormState, value: string) => {
    const nextValue = key === "name" || key === "nacaCode" || key === "datText" ? value : Number(value);
    formController.update(key, nextValue);
  };

  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-slate-950/10" aria-label="編集を閉じる" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full flex-col border-l bg-white shadow-xl sm:max-w-[440px]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="一覧に戻る" onClick={onClose}>
              <ArrowLeft size={18} />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">作成・編集はダッシュボードから分離します。</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="編集を閉じる" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {mode === "import-dat" ? (
            <TextArea label=".dat内容" value={formController.state.value.datText} onChange={(value) => update("datText", value)} />
          ) : mode === "create-naca" ? (
            <Input label="NACAコード" value={formController.state.value.nacaCode} onChange={(value) => update("nacaCode", value)} />
          ) : null}

          <Input label="翼型名" value={formController.state.value.name} onChange={(value) => update("name", value)} />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="厚み比" value={formController.state.value.thicknessRatio} onChange={(value) => update("thicknessRatio", value)} />
            <NumberInput label="最大キャンバー" value={formController.state.value.maxCamber} onChange={(value) => update("maxCamber", value)} />
            <NumberInput label="LE半径" value={formController.state.value.leadingEdgeRadius} step="0.01" onChange={(value) => update("leadingEdgeRadius", value)} />
            <NumberInput label="TE厚" value={formController.state.value.trailingEdgeThickness} step="0.01" onChange={(value) => update("trailingEdgeThickness", value)} />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">形状プレビュー</p>
            <AirfoilPlot airfoil={previewAirfoil} className="h-44 min-h-0" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button onClick={formController.submit}>
            <Save size={16} />
            保存
          </Button>
        </div>
      </aside>
    </div>
  );
}

function isSameForm(left: AirfoilFormState, right: AirfoilFormState) {
  return Object.keys(left).every((key) => left[key as keyof AirfoilFormState] === right[key as keyof AirfoilFormState]);
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberInput({ label, value, step = "0.1", onChange }: { label: string; value: number; step?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input type="number" step={step} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<textarea className="mt-1 h-36 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function buildPreviewAirfoil(mode: AirfoilEditorMode, existingId: string | undefined, form: AirfoilFormState): Airfoil {
  const nacaMatch = /^([0-9])([0-9])([0-9]{2})$/.exec(form.nacaCode.trim());
  const maxCamber = mode === "create-naca" && nacaMatch ? Number(nacaMatch[1]) : form.maxCamber;
  const thicknessRatio = mode === "create-naca" && nacaMatch ? Number(nacaMatch[3]) : form.thicknessRatio;

  const id = mode === "edit" && existingId ? existingId : `af-${(mode === "create-naca" && nacaMatch ? `naca${form.nacaCode}` : form.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return {
    id,
    name: mode === "create-naca" && nacaMatch ? `NACA${form.nacaCode.trim()}` : form.name,
    thicknessRatio,
    maxCamber,
    leadingEdgeRadius: form.leadingEdgeRadius,
    trailingEdgeThickness: form.trailingEdgeThickness,
    coordinates: makeAirfoilCoordinates(maxCamber / 100, thicknessRatio / 100),
  };
}

function makeAirfoilCoordinates(camber: number, thickness: number) {
  return Array.from({ length: 17 }, (_, index) => {
    const x = index / 16;
    const thicknessShape = thickness * 0.42 * Math.sin(Math.PI * x) * (1 - 0.18 * x);
    const camberLine = camber * Math.sin(Math.PI * x) * (1 - 0.28 * x);
    return {
      x,
      upper: camberLine + thicknessShape,
      lower: camberLine - thicknessShape,
    };
  });
}
