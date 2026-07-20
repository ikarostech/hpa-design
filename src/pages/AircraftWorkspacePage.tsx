import { AlertTriangle, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AircraftPreview } from "../features/aircraft/components/AircraftPreview";
import { applyAircraftDraft, createAircraftDraft, type AircraftDraft, type AircraftDraftValidation, validateAircraftDraft } from "../features/aircraft/model/aircraftDraft";
import type { AircraftGeometry, WingSection } from "../features/aircraft/model/types";
import type { Airfoil } from "../features/airfoils/model/types";
import type { FormController } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";

interface AircraftWorkspacePageProps {
  aircraft: AircraftGeometry;
  airfoils: readonly Airfoil[];
  onUpdateAircraft: (patch: Partial<AircraftGeometry>) => void;
}

export function AircraftWorkspacePage({ aircraft, airfoils, onUpdateAircraft }: AircraftWorkspacePageProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialDraft = useMemo(() => createAircraftDraft(aircraft), [aircraft]);
  const [draft, setDraft] = useState<AircraftDraft>(initialDraft);
  useEffect(() => setDraft(initialDraft), [initialDraft]);
  useEffect(() => {
    const airfoilId = params.get("airfoilId");
    if (!airfoilId || !airfoils.some((airfoil) => airfoil.id === airfoilId)) return;
    setDraft((current) => ({ ...current, sections: current.sections.map((section, index) => index === 0 ? { ...section, airfoilId } : section) }));
  }, [airfoils, params]);

  const validation = validateAircraftDraft(draft, new Set(airfoils.map((airfoil) => airfoil.id)));
  const preview = applyAircraftDraft(draft, aircraft);
  const dirty = !isSameDraft(draft, initialDraft);
  const formController: FormController<AircraftDraft, AircraftDraftValidation["errors"]> = {
    state: { value: draft, initialValue: initialDraft, errors: validation.errors, dirty, valid: validation.valid, submitting: false },
    update: (key, value) => setDraft((current) => synchronizeEndpoints({ ...current, [key]: value })),
    patch: (value) => setDraft((current) => synchronizeEndpoints({ ...current, ...value })),
    reset: (value = initialDraft) => setDraft(value),
    submit: async () => {
      if (validation.valid) onUpdateAircraft(applyAircraftDraft(draft, aircraft));
    },
  };

  const updateNumber = (field: Exclude<keyof AircraftDraft, "sections">, value: string) => {
    formController.update(field, Number(value) as AircraftDraft[typeof field]);
  };

  const updateSection = (index: number, patch: Partial<WingSection>) => {
    setDraft((current) => synchronizeDimensionsFromSections({
      ...current,
      sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    }));
  };

  const addSection = () => {
    setDraft((current) => {
      const tip = current.sections[current.sections.length - 1];
      const previous = current.sections[current.sections.length - 2] ?? tip;
      const section: WingSection = {
        id: createSectionId(),
        spanPosition: (previous.spanPosition + tip.spanPosition) / 2,
        chord: (previous.chord + tip.chord) / 2,
        twist: (previous.twist + tip.twist) / 2,
        dihedral: (previous.dihedral + tip.dihedral) / 2,
        airfoilId: previous.airfoilId,
        controlSurface: "none",
      };
      return { ...current, sections: [...current.sections.slice(0, -1), section, tip] };
    });
  };

  const removeSection = (index: number) => {
    setDraft((current) => current.sections.length <= 2 ? current : synchronizeDimensionsFromSections({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
    }));
  };

  const moveSection = (index: number, offset: -1 | 1) => {
    setDraft((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.sections.length) return current;
      const positions = current.sections.map((section) => section.spanPosition).sort((left, right) => left - right);
      const sections = current.sections.map((section) => ({ ...section }));
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return synchronizeDimensionsFromSections({ ...current, sections: sections.map((section, sectionIndex) => ({ ...section, spanPosition: positions[sectionIndex] })) });
    });
  };

  const fieldError = (field: Exclude<keyof AircraftDraft, "sections">) => validation.valid ? undefined : validation.errors[field];
  const sectionErrors = validation.valid ? [] : validation.errors.sections ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">機体ワークスペース</h1>
          <p className="mt-1 text-sm text-slate-500">主翼セクションを編集し、検証後に保存して解析用ジオメトリへ反映します。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!dirty} onClick={() => formController.reset()}>キャンセル</Button>
          <Button disabled={!dirty || !validation.valid} onClick={() => void formController.submit()}><Save size={16} />保存</Button>
          <Button onClick={() => navigate("/analysis")}>解析に進む<ChevronRight size={16} /></Button>
        </div>
      </div>

      {!validation.valid && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">入力を修正してから保存してください。</div>}
      {!airfoils.length && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">翼型ライブラリが空です。機体に翼型を割り当てるには、先に翼型を追加してください。</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">3Dプレビュー</h2><Badge tone="blue">下書き表示</Badge></CardHeader>
            <CardBody><AircraftPreview geometry={preview} /></CardBody>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">主翼セクション</h2><Button variant="secondary" onClick={addSection}><Plus size={16} />セクションを追加</Button></CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500"><tr><th className="p-2">Span位置</th><th className="p-2">Chord</th><th className="p-2">Twist</th><th className="p-2">Dihedral</th><th className="p-2">Airfoil</th><th className="p-2">Control surface</th><th className="p-2 text-right">操作</th></tr></thead>
                  <tbody>{draft.sections.map((section, index) => <tr key={section.id} className="border-b border-slate-100">
                    <td className="p-2"><input aria-label={`Section ${index + 1} span position`} type="number" step="0.01" value={section.spanPosition} onChange={(event) => updateSection(index, { spanPosition: Number(event.target.value) })} className="w-24 rounded border border-slate-200 px-2 py-1" /></td>
                    <td className="p-2"><input aria-label={`Section ${index + 1} chord`} type="number" step="0.01" value={section.chord} onChange={(event) => updateSection(index, { chord: Number(event.target.value) })} className="w-24 rounded border border-slate-200 px-2 py-1" /></td>
                    <td className="p-2"><input aria-label={`Section ${index + 1} twist`} type="number" step="0.1" value={section.twist} onChange={(event) => updateSection(index, { twist: Number(event.target.value) })} className="w-20 rounded border border-slate-200 px-2 py-1" /></td>
                    <td className="p-2"><input aria-label={`Section ${index + 1} dihedral`} type="number" step="0.1" value={section.dihedral} onChange={(event) => updateSection(index, { dihedral: Number(event.target.value) })} className="w-20 rounded border border-slate-200 px-2 py-1" /></td>
                    <td className="p-2"><select aria-label={`Section ${index + 1} airfoil`} value={section.airfoilId} onChange={(event) => updateSection(index, { airfoilId: event.target.value })} className="rounded border border-slate-200 px-2 py-1">{airfoils.map((airfoil) => <option key={airfoil.id} value={airfoil.id}>{airfoil.name}</option>)}</select></td>
                    <td className="p-2"><select aria-label={`Section ${index + 1} control surface`} value={section.controlSurface} onChange={(event) => updateSection(index, { controlSurface: event.target.value })} className="rounded border border-slate-200 px-2 py-1"><option value="none">なし</option><option value="flap">フラップ</option><option value="aileron">エルロン</option></select></td>
                    <td className="p-2"><div className="flex justify-end gap-1"><Button aria-label={`Section ${index + 1} move up`} variant="ghost" disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</Button><Button aria-label={`Section ${index + 1} move down`} variant="ghost" disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)}>↓</Button><Button aria-label={`Section ${index + 1} delete`} variant="ghost" disabled={draft.sections.length <= 2} onClick={() => removeSection(index)}><Trash2 size={16} /></Button></div></td>
                  </tr>)}</tbody>
                </table>
              </div>
              {sectionErrors.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">{sectionErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold text-slate-950">主翼プロパティ</h2></CardHeader>
          <CardBody className="space-y-3">
            <NumberInput label="スパン" value={draft.span} error={fieldError("span")} onChange={(value) => updateNumber("span", value)} />
            <NumberInput label="ルート弦長" value={draft.rootChord} error={fieldError("rootChord")} onChange={(value) => updateNumber("rootChord", value)} />
            <NumberInput label="チップ弦長" value={draft.tipChord} error={fieldError("tipChord")} onChange={(value) => updateNumber("tipChord", value)} />
            <NumberInput label="ねじり角" value={draft.twist} error={fieldError("twist")} onChange={(value) => updateNumber("twist", value)} />
            <NumberInput label="上反角" value={draft.dihedral} error={fieldError("dihedral")} onChange={(value) => updateNumber("dihedral", value)} />
            <NumberInput label="後退角" value={draft.sweep} error={fieldError("sweep")} onChange={(value) => updateNumber("sweep", value)} />
            <NumberInput label="取り付け角" value={draft.incidence} error={fieldError("incidence")} onChange={(value) => updateNumber("incidence", value)} />
            <ReadOnlyValue label="テーパー比" value={preview.taperRatio.toFixed(3)} />
            <ReadOnlyValue label="翼面積" value={`${preview.wingArea.toFixed(2)} m²`} />
            <ReadOnlyValue label="アスペクト比" value={preview.aspectRatio.toFixed(3)} />
            <ReadOnlyValue label="MAC" value={`${preview.mac.toFixed(3)} m`} />
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-amber-900"><AlertTriangle size={18} /><span>Polar未作成の翼型があります。解析前に翼型解析を完了してください。</span></div>
        <Button variant="secondary" onClick={() => navigate("/airfoils")}>Polarへ移動</Button>
      </div>
    </div>
  );
}

function synchronizeEndpoints(draft: AircraftDraft): AircraftDraft {
  if (draft.sections.length < 2) return draft;
  return {
    ...draft,
    sections: draft.sections.map((section, index) => index === 0 ? { ...section, chord: draft.rootChord } : index === draft.sections.length - 1 ? { ...section, chord: draft.tipChord, spanPosition: draft.span / 2 } : section),
  };
}

function synchronizeDimensionsFromSections(draft: AircraftDraft): AircraftDraft {
  if (draft.sections.length < 2) return draft;
  return { ...draft, rootChord: draft.sections[0].chord, tipChord: draft.sections[draft.sections.length - 1].chord };
}

function isSameDraft(left: AircraftDraft, right: AircraftDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createSectionId() {
  return `section-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}

function NumberInput({ label, value, error, onChange }: { label: string; value: number; error?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input aria-invalid={Boolean(error)} type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
}
