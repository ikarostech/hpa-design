import { Save, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormController, ValidationIssue } from "@/shared/model";
import { createDatAirfoilPreview, createNacaAirfoilPreview, readAirfoilDatFile } from "../services/airfoilCreationService";
import type { Airfoil } from "../model/types";
import type { AirfoilEditorMode } from "../model/workspace";
import { Button } from "../../../shared/ui/Button";
import { InspectorDrawer } from "../../../shared/ui/inspector/InspectorDrawer";
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
  datText: string;
}

const defaultForm: AirfoilFormState = {
  name: "",
  nacaCode: "0012",
  datText: "",
};

export function AirfoilEditorDrawer({ mode, airfoil, open, onClose, onSave }: AirfoilEditorDrawerProps) {
  const [form, setForm] = useState<AirfoilFormState>(defaultForm);
  const createdId = useRef("");

  useEffect(() => {
    if (!open || !mode) {
      return;
    }
    createdId.current = (mode === "edit" || mode === "reapply-dat") && airfoil ? airfoil.id : `af-${Date.now().toString(36)}`;
    if ((mode === "edit" || mode === "reapply-dat") && airfoil) {
      setForm({ name: airfoil.name, nacaCode: "", datText: "" });
      return;
    }
    setForm({ ...defaultForm });
  }, [airfoil, mode, open]);

  const datState = useMemo(() => {
    if ((mode !== "import-dat" && mode !== "reapply-dat") || !form.datText.trim()) {
      return null;
    }
    return createDatAirfoilPreview({ datText: form.datText, id: createdId.current, name: form.name });
  }, [form.datText, form.name, mode]);

  const nacaState = useMemo(
    () => mode === "create-naca" ? createNacaAirfoilPreview(form.nacaCode, createdId.current) : null,
    [form.nacaCode, mode],
  );
  const previewAirfoil = useMemo(() => {
    if (nacaState?.valid) {
      return nacaState.airfoil;
    }
    if (datState?.valid) {
      return datState.airfoil;
    }
    if (mode === "edit" && airfoil) {
      return { ...airfoil, name: form.name.trim() || airfoil.name };
    }
    return null;
  }, [airfoil, datState, form.name, mode, nacaState]);

  if (!open || !mode) {
    return null;
  }

  const error = nacaState && !nacaState.valid ? nacaState.error : datState && !datState.valid ? datState.error : null;
  const valid = Boolean(previewAirfoil) && !error;
  const title = mode === "edit" ? "翼型を編集" : mode === "reapply-dat" ? "翼型座標を更新" : mode === "import-dat" ? ".datから翼型を作成" : "NACA翼型を作成";
  const formController: FormController<AirfoilFormState> = {
    state: {
      value: form,
      initialValue: defaultForm,
      errors: {},
      dirty: !isSameForm(form, defaultForm),
      valid,
      submitting: false,
    },
    update: (key, value) => setForm((current) => ({ ...current, [key]: value })),
    patch: (value) => setForm((current) => ({ ...current, ...value })),
    reset: (value = defaultForm) => setForm(value),
    submit: async () => {
      if (previewAirfoil && valid) {
        onSave(previewAirfoil);
      }
    },
  };

  const update = (key: keyof AirfoilFormState, value: string) => formController.update(key, value);
  const loadFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const datText = await readAirfoilDatFile(file);
    let name = form.name;
    const preview = createDatAirfoilPreview({ datText, id: createdId.current, name });
    if (preview.valid) {
      name = name || preview.suggestedName;
    }
    formController.patch({ datText, name });
  };

  return (
    <InspectorDrawer
      open={open}
      title={title}
      subtitle="座標を検証してから保存します。"
      closeLabel="編集を閉じる"
      backLabel="一覧に戻る"
      onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>キャンセル</Button>
        <Button disabled={!valid} onClick={formController.submit}><Save size={16} />保存</Button>
      </div>}
    >
        <div className="space-y-4">
          {mode === "import-dat" || mode === "reapply-dat" ? (
            <>
              <label className="block text-sm font-medium text-slate-700">
                .dat ファイル
                <span className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-3 text-sm font-normal text-slate-600 hover:border-blue-400 hover:bg-blue-50">
                  <Upload size={16} /> ファイルを選択
                  <input className="sr-only" type="file" accept=".dat,.txt,text/plain" onChange={(event) => void loadFile(event.target.files?.[0])} />
                </span>
              </label>
              <TextArea label="または座標を貼り付け" value={form.datText} onChange={(value) => update("datText", value)} />
              {datState?.valid ? <ImportSummary format={datState.format} points={datState.pointCount} issues={datState.issues} /> : null}
              {(mode === "import-dat" || mode === "reapply-dat") && error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              <Input label="翼型名" value={form.name} placeholder={datState?.valid ? datState.suggestedName : "ファイル名を使用"} onChange={(value) => update("name", value)} />
              {mode === "reapply-dat" ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">保存すると、この翼型を使用する Polar と解析結果は「要確認」になり、再解析が必要です。</p> : null}
            </>
          ) : mode === "create-naca" ? (
            <>
              <Input label="NACA 4桁" value={form.nacaCode} inputMode="numeric" placeholder="2412" onChange={(value) => update("nacaCode", value.replace(/\s/g, ""))} />
              <p className="text-xs text-slate-500">1桁目: 最大キャンバー、2桁目: その位置、末尾2桁: 最大厚み比。例: 2412</p>
              {nacaState && !nacaState.valid ? <p className="text-sm text-red-700">{nacaState.error}</p> : null}
            </>
          ) : (
            <>
              <Input label="翼型名" value={form.name} onChange={(value) => update("name", value)} />
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">形状座標は保持されます。座標を差し替える場合は .dat から新しく作成してください。</p>
            </>
          )}

          {mode === "reapply-dat" && airfoil ? <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-sm font-semibold text-slate-800">更新前</p><AirfoilPlot airfoil={airfoil} className="h-36 min-h-0" /></div>{previewAirfoil ? <div><p className="mb-2 text-sm font-semibold text-slate-800">更新後</p><AirfoilPlot airfoil={previewAirfoil} className="h-36 min-h-0" /></div> : null}</div> : previewAirfoil ? <div><p className="mb-2 text-sm font-semibold text-slate-800">形状プレビュー</p><AirfoilPlot airfoil={previewAirfoil} className="h-44 min-h-0" /></div> : null}
        </div>
    </InspectorDrawer>
  );
}

function ImportSummary({ format, points, issues }: { format: string; points: number; issues: readonly ValidationIssue[] }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"><p><span className="font-semibold text-slate-800">{format === "selig" ? "Selig" : "Lednicer"}</span> 形式として読み込みました（正規化後 {points} 点）。</p>{issues.map((issue) => <p key={issue.message} className="mt-1 text-amber-700">{issue.message}</p>)}</div>;
}

function isSameForm(left: AirfoilFormState, right: AirfoilFormState) {
  return Object.keys(left).every((key) => left[key as keyof AirfoilFormState] === right[key as keyof AirfoilFormState]);
}

function Input({ label, value, placeholder, inputMode, onChange }: { label: string; value: string; placeholder?: string; inputMode?: "numeric"; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" value={value} placeholder={placeholder} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<textarea className="mt-1 h-40 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-400" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
