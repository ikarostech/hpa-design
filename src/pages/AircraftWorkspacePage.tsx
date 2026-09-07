import { AlertTriangle, ChevronRight, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AircraftPreview } from "../features/aircraft/components/AircraftPreview";
import { applyAircraftDraft, createAircraftDraft, type AircraftDraft, type AircraftDraftValidation, validateAircraftDraft } from "../features/aircraft/model/aircraftDraft";
import type { AircraftGeometry, PanelDistribution, WingSection } from "../features/aircraft/model/types";
import type { Airfoil } from "../features/airfoils/model/types";
import type { FormController } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";
import { OrderedEntityTable, type OrderedTableColumn } from "../shared/ui/table/OrderedEntityTable";
import { RowActions } from "../shared/ui/table/RowActions";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

interface AircraftWorkspacePageProps {
  aircraft: AircraftGeometry;
  airfoils: readonly Airfoil[];
  onUpdateAircraft: (patch: Partial<AircraftGeometry>) => void;
}

const distributions: { value: PanelDistribution; label: string }[] = [
  { value: "uniform", label: "Uniform" },
  { value: "cosine", label: "Cosine" },
  { value: "sine", label: "Sine" },
  { value: "inverse-sine", label: "-Sine" },
];

export function AircraftWorkspacePage({ aircraft, airfoils, onUpdateAircraft }: AircraftWorkspacePageProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialDraft = useMemo(() => createAircraftDraft(aircraft), [aircraft]);
  const [draft, setDraft] = useState<AircraftDraft>(initialDraft);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialDraft.sections[0]?.id ?? null);

  useEffect(() => {
    setDraft(initialDraft);
    setSelectedSectionId((current) => initialDraft.sections.some((section) => section.id === current) ? current : initialDraft.sections[0]?.id ?? null);
  }, [initialDraft]);
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
    update: (key, value) => setDraft((current) => ({ ...current, [key]: value })),
    patch: (value) => setDraft((current) => ({ ...current, ...value })),
    reset: (value = initialDraft) => setDraft(value),
    submit: async () => {
      if (validation.valid) onUpdateAircraft(applyAircraftDraft(draft, aircraft));
    },
  };

  const updateSection = (sectionId: string, patch: Partial<WingSection>) => {
    setDraft((current) => ({
      ...current,
      sections: sortWingSections(
        current.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
        current.sections[0]?.id,
      ),
    }));
  };

  const insertSectionAfter = (sectionId: string) => {
    setDraft((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      return index < 0 ? current : insertSectionAfterIndex(current, index);
    });
  };

  const insertSectionBefore = (sectionId: string) => {
    setDraft((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return current;
      if (index > 0) return insertSectionAfterIndex(current, index - 1);
      const root = current.sections[0];
      const next = current.sections[1];
      if (!root || !next) return current;
      const newRoot = { ...root, id: createSectionId() };
      const shiftedRoot = { ...root, yPosition: interpolate(root.yPosition, next.yPosition, 0.5) };
      return { ...current, sections: [newRoot, shiftedRoot, ...current.sections.slice(2)] };
    });
  };

  const removeSection = (sectionId: string) => {
    setDraft((current) => current.sections.length <= 2 ? current : {
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    });
    setPendingDeleteId(null);
  };

  const fieldError = (field: "incidence" | "staticMargin") => validation.valid ? undefined : validation.errors[field];
  const sectionErrors = validation.valid ? [] : validation.errors.sections ?? [];
  const pendingDeleteIndex = draft.sections.findIndex((section) => section.id === pendingDeleteId);
  const sectionColumns: OrderedTableColumn<WingSection>[] = [
    { key: "y-position", header: "Y Position", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} Y position`} value={section.yPosition} step={0.01} unit="m" disabled={index === 0} onChange={(value) => updateSection(section.id, { yPosition: value })} /> },
    { key: "chord", header: "Chord", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} chord`} value={section.chord} step={0.01} unit="m" onChange={(value) => updateSection(section.id, { chord: value })} /> },
    { key: "x-offset", header: "X Offset", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} X offset`} value={section.xOffset} step={0.01} unit="m" onChange={(value) => updateSection(section.id, { xOffset: value })} /> },
    { key: "dihedral", header: "Dihedral", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} dihedral`} value={section.dihedral} step={0.1} unit="°" onChange={(value) => updateSection(section.id, { dihedral: value })} /> },
    { key: "twist", header: "Twist", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} twist`} value={section.twist} step={0.1} unit="°" onChange={(value) => updateSection(section.id, { twist: value })} /> },
    { key: "airfoil", header: "Airfoil", renderCell: (section, index) => <select aria-label={`Section ${index + 1} airfoil`} value={section.airfoilId} onChange={(event) => updateSection(section.id, { airfoilId: event.target.value })} className="h-9 min-w-32 rounded border border-slate-200 px-2">{airfoils.map((airfoil) => <option key={airfoil.id} value={airfoil.id}>{airfoil.name}</option>)}</select> },
    { key: "x-panels", header: "X Panels", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} X panels`} value={section.chordwisePanels} step={1} onChange={(value) => updateSection(section.id, { chordwisePanels: value })} /> },
    { key: "x-distribution", header: "X Distribution", renderCell: (section, index) => <DistributionSelect label={`Section ${index + 1} X distribution`} value={section.chordwiseDistribution} onChange={(value) => updateSection(section.id, { chordwiseDistribution: value })} /> },
    { key: "y-panels", header: "Y Panels", renderCell: (section, index) => <NumericCell label={`Section ${index + 1} Y panels`} value={section.spanwisePanels} step={1} onChange={(value) => updateSection(section.id, { spanwisePanels: value })} /> },
    { key: "y-distribution", header: "Y Distribution", renderCell: (section, index) => <DistributionSelect label={`Section ${index + 1} Y distribution`} value={section.spanwiseDistribution} onChange={(value) => updateSection(section.id, { spanwiseDistribution: value })} /> },
  ];

  return (
    <PageTemplate
      title="空力設計"
      description="主翼形状と翼型配置を編集し、剛体翼解析に使用するジオメトリを定義します。"
      actions={<>
          <Button variant="secondary" disabled={!dirty} onClick={() => formController.reset()}>キャンセル</Button>
          <Button disabled={!dirty || !validation.valid} onClick={() => void formController.submit()}><Save size={16} />保存</Button>
          <Button onClick={() => navigate("/aerodynamics/analysis")}>解析に進む<ChevronRight size={16} /></Button>
      </>}
      tabs={<AerodynamicDesignTabs />}
      notices={<>
        {!validation.valid && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">入力を修正してから保存してください。</div>}
        {!airfoils.length && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">翼型ライブラリが空です。機体に翼型を割り当てるには、先に翼型を追加してください。</div>}
      </>}
    >

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">翼形状プレビュー</h2><Badge tone="blue">下書き表示</Badge></CardHeader>
            <CardBody><AircraftPreview geometry={preview} selectedSectionId={selectedSectionId} onSelectSection={setSelectedSectionId} /></CardBody>
          </Card>

          <OrderedEntityTable
            title="主翼セクション"
            description="Y位置・弦長・前縁オフセット・角度・解析メッシュを半翼で定義します。"
            itemLabel="セクション"
            items={draft.sections}
            columns={sectionColumns}
            getKey={(section) => section.id}
            getRowLabel={(_, index) => `Section ${index + 1}`}
            selectedKey={selectedSectionId}
            onSelect={setSelectedSectionId}
            insertBefore={{ onAction: insertSectionBefore }}
            insertAfter={{ onAction: insertSectionAfter }}
            renderActions={(section, index) => <RowActions entityLabel={`Section ${index + 1}`} delete={{ disabled: index === 0 || draft.sections.length <= 2, disabledReason: index === 0 ? "ルート断面は削除できません" : draft.sections.length <= 2 ? "主翼には2断面以上必要です" : undefined, onAction: () => setPendingDeleteId(section.id) }} />}
            minWidthClassName="min-w-[1380px]"
            footer={sectionErrors.length > 0 ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">{sectionErrors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          />
        </div>

        <Card>
          <CardHeader><h2 className="font-semibold text-slate-950">主翼プロパティ</h2><p className="mt-1 text-xs text-slate-500">断面列から自動計算されます。</p></CardHeader>
          <CardBody className="space-y-3">
            <NumberInput label="取り付け角" unit="°" value={draft.incidence} error={fieldError("incidence")} onChange={(value) => formController.update("incidence", Number(value))} />
            <ReadOnlyValue label="スパン" value={`${preview.span.toFixed(3)} m`} />
            <ReadOnlyValue label="ルート弦長" value={`${preview.rootChord.toFixed(3)} m`} />
            <ReadOnlyValue label="チップ弦長" value={`${preview.tipChord.toFixed(3)} m`} />
            <ReadOnlyValue label="1/4弦後退角" value={`${preview.sweep.toFixed(2)}°`} />
            <ReadOnlyValue label="代表上反角" value={`${preview.dihedral.toFixed(2)}°`} />
            <ReadOnlyValue label="ねじり差" value={`${preview.twist.toFixed(2)}°`} />
            <ReadOnlyValue label="テーパー比" value={preview.taperRatio.toFixed(3)} />
            <ReadOnlyValue label="翼面積" value={`${preview.wingArea.toFixed(3)} m²`} />
            <ReadOnlyValue label="アスペクト比" value={preview.aspectRatio.toFixed(3)} />
            <ReadOnlyValue label="MAC" value={`${preview.mac.toFixed(3)} m`} />
            <ReadOnlyValue label="静安定余裕" value={`${draft.staticMargin.toFixed(1)}%`} />
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-amber-900"><AlertTriangle size={18} /><span>Polar未作成の翼型があります。解析前に翼型解析を完了してください。</span></div>
        <Button variant="secondary" onClick={() => navigate("/aerodynamics/airfoils")}>Polarへ移動</Button>
      </div>

      <DeleteConfirmationDialog
        open={pendingDeleteId !== null}
        title={pendingDeleteIndex >= 0 ? `Section ${pendingDeleteIndex + 1}を削除しますか？` : "セクションを削除しますか？"}
        description="この断面を削除すると、隣接する断面同士が新しい翼パネルとして接続されます。"
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && removeSection(pendingDeleteId)}
      />
    </PageTemplate>
  );
}

function NumericCell({ label, value, step, unit, disabled = false, onChange }: { label: string; value: number; step: number; unit?: string; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="flex items-center gap-1"><span className="sr-only">{label}</span><input aria-label={label} type="number" step={step} value={formatEditableNumber(value)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-20 rounded border border-slate-200 px-2 disabled:bg-slate-100" />{unit ? <span className="text-xs text-slate-400">{unit}</span> : null}</label>;
}

function DistributionSelect({ label, value, onChange }: { label: string; value: PanelDistribution; onChange: (value: PanelDistribution) => void }) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as PanelDistribution)} className="h-9 rounded border border-slate-200 px-2">{distributions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function NumberInput({ label, value, unit, error, onChange }: { label: string; value: number; unit?: string; error?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<span className="relative mt-1 block"><input aria-label={label} aria-invalid={Boolean(error)} type="number" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 pr-9 text-sm outline-none focus:border-blue-400" />{unit ? <span className="absolute right-3 top-2 text-sm text-slate-400">{unit}</span> : null}</span>{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>;
}

function interpolate(start: number, end: number, ratio: number) {
  return start + (end - start) * ratio;
}

function insertSectionAfterIndex(draft: AircraftDraft, index: number): AircraftDraft {
  const root = draft.sections[index];
  const tip = draft.sections[index + 1];
  const previous = draft.sections[index - 1];
  const extension = Math.max(0.1, root.yPosition - (previous?.yPosition ?? 0) || 1);
  const ratio = tip ? 0.5 : 1;
  const section: WingSection = {
    ...root,
    id: createSectionId(),
    yPosition: tip ? interpolate(root.yPosition, tip.yPosition, ratio) : root.yPosition + extension,
    chord: tip ? interpolate(root.chord, tip.chord, ratio) : root.chord,
    xOffset: tip ? interpolate(root.xOffset, tip.xOffset, ratio) : root.xOffset,
    twist: tip ? interpolate(root.twist, tip.twist, ratio) : root.twist,
    dihedral: root.dihedral,
    airfoilId: root.airfoilId,
  };
  return { ...draft, sections: [...draft.sections.slice(0, index + 1), section, ...draft.sections.slice(index + 1)] };
}

function formatEditableNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
}

function sortWingSections(sections: WingSection[], rootSectionId: string | undefined) {
  return [...sections].sort((left, right) => {
    if (left.id === rootSectionId) return -1;
    if (right.id === rootSectionId) return 1;
    return left.yPosition - right.yPosition;
  });
}

function isSameDraft(left: AircraftDraft, right: AircraftDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createSectionId() {
  return `section-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
}
