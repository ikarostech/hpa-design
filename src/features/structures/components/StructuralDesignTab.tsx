import { Plus } from "lucide-react";
import { useState } from "react";
import type { InspectorController, InspectorState } from "../../../shared/model";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { DeleteConfirmationDialog } from "../../../shared/ui/table/DeleteConfirmationDialog";
import { RowActions } from "../../../shared/ui/table/RowActions";
import {
  createDefaultMaterial,
  createStructuralId,
  createTubeSection,
  getSectionSummary,
  materialReferenceCount,
  structuralSpan,
  tubeSectionBounds,
} from "../model/structuralWorkspace";
import type { CarbonMaterial, LaminatePly, StructuralDesign, StructuralTubeSection } from "../model/types";
import { MaterialPropertyDrawer } from "./MaterialPropertyDrawer";
import { StructuralDesignPropertiesChart } from "./StructuralDesignPropertiesChart";
import { TubeSectionDetailDrawer } from "./TubeSectionDetailDrawer";

export function StructuralDesignTab({ design, designs, materials, selectedSectionId, onSelectSection, onSaveDesign, onSaveMaterial, onRemoveMaterial }: {
  design: StructuralDesign;
  designs: readonly StructuralDesign[];
  materials: readonly CarbonMaterial[];
  selectedSectionId: string | null;
  onSelectSection: (id: string) => void;
  onSaveDesign: (design: StructuralDesign) => void;
  onSaveMaterial: (material: CarbonMaterial) => void;
  onRemoveMaterial: (id: string) => void;
}) {
  const [detailState, setDetailState] = useState<InspectorState<string>>({ open: false, mode: "detail", targetId: null });
  const [pendingSectionDeleteId, setPendingSectionDeleteId] = useState<string | null>(null);
  const selected = design.sections.find((section) => section.id === selectedSectionId) ?? design.sections[0];
  const selectedSummary = selected ? getSectionSummary(selected, materials) : null;
  const bounds = tubeSectionBounds(design.sections);
  const selectedBounds = bounds.find((bound) => bound.section.id === selected?.id);
  const detailBounds = bounds.find((bound) => bound.section.id === detailState.targetId);
  const detailInspector: InspectorController<string> = {
    state: detailState,
    openDetail: (id) => setDetailState({ open: true, mode: "detail", targetId: id }),
    openCreate: () => setDetailState({ open: true, mode: "create", targetId: null }),
    openEdit: (id) => setDetailState({ open: true, mode: "edit", targetId: id }),
    close: () => setDetailState((current) => ({ ...current, open: false })),
  };
  const updateSection = (id: string, patch: Partial<StructuralTubeSection>) => onSaveDesign({ ...design, sections: design.sections.map((section) => section.id === id ? { ...section, ...patch } : section) });

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card><CardHeader className="flex items-center justify-between"><h2 className="font-semibold">パイプ配置プレビュー</h2><Badge tone="blue">片翼・段階切替</Badge></CardHeader><CardBody><SparPreview design={design} selectedId={selected?.id} onSelect={onSelectSection} /></CardBody></Card>
      <Card><CardHeader><h2 className="font-semibold">選択パイプセクション</h2></CardHeader><CardBody className="space-y-3">{selected ? <>
        <label className="block text-sm"><span className="mb-1 block text-xs text-slate-500">構造設計名</span><input aria-label="構造設計名" value={design.name} onChange={(event) => onSaveDesign({ ...design, name: event.target.value })} className="h-9 w-full rounded border px-2" /></label>
        <ReadValue label="開始・終了位置" value={`${selectedBounds?.start.toFixed(3)}–${selectedBounds?.end.toFixed(3)} m`} />
        <NumberField label="セクション長さ" unit="m" value={selected.length} onChange={(value) => updateSection(selected.id, { length: value })} />
        <NumberField label="外径" unit="mm" value={selected.outerDiameter * 1000} onChange={(value) => updateSection(selected.id, { outerDiameter: value / 1000 })} />
        <ReadValue label="積層" value={layupLabel(selected.plies)} />
        <ReadValue label="総層数" value={`${selected.plies.reduce((sum, ply) => sum + ply.count, 0)} ply`} />
        {selectedSummary ? <><ReadValue label="積層厚さ / 内径" value={`${(selectedSummary.thickness * 1000).toFixed(3)} / ${(selectedSummary.innerDiameter * 1000).toFixed(2)} mm`} /><ReadValue label="単位長さ重量" value={`${selectedSummary.linearMass.toFixed(3)} kg/m`} /></> : null}
      </> : <p className="text-sm text-slate-500">パイプセクションを選択してください。</p>}</CardBody></Card>
    </div>

    <Card>
      <CardHeader><h2 className="font-semibold">パイプ設計特性</h2><p className="mt-1 text-sm text-slate-500">パイプ設計の変更を、翼幅方向の曲げ強度・破壊モードと剛性へリアルタイムに反映します。</p></CardHeader>
      <CardBody><StructuralDesignPropertiesChart design={design} materials={materials} selectedSectionId={selected?.id} /></CardBody>
    </Card>

    <Card>
      <CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">CFRPパイプセクション</h2><p className="mt-1 text-sm text-slate-500">各セクションは指定長さの全域で同じ外径・積層構成です。線形補間は行いません。</p></div><Button size="sm" onClick={() => { const section = createTubeSection(materials[0]); onSaveDesign({ ...design, sections: [...design.sections, section] }); onSelectSection(section.id); }} disabled={!materials.length}><Plus size={15} />セクション</Button></CardHeader>
      <CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">範囲</th><th>長さ</th><th>外径</th><th>積層</th><th className="text-right">操作</th></tr></thead><tbody>
        {bounds.map(({ section, start, end }) => <tr key={section.id} className={`border-t ${section.id === selected?.id ? "bg-blue-50" : ""}`} onClick={() => onSelectSection(section.id)}><td className="px-2 py-2">{start.toFixed(3)}–{end.toFixed(3)} m</td><td>{section.length.toFixed(3)} m</td><td>{(section.outerDiameter * 1000).toFixed(1)} mm</td><td>{layupLabel(section.plies)}</td><td className="text-right"><RowActions entityLabel={section.id} detail={{ active: detailState.open && detailState.targetId === section.id, onAction: () => { onSelectSection(section.id); detailInspector.openDetail(section.id); } }} delete={{ disabled: design.sections.length <= 1, disabledReason: design.sections.length <= 1 ? "最低1本のパイプが必要です" : undefined, onAction: () => setPendingSectionDeleteId(section.id) }} /></td></tr>)}
      </tbody></table></div></CardBody>
    </Card>

    <SupportEditor design={design} onSave={onSaveDesign} />
    <MaterialLibrary designs={designs} materials={materials} onSave={onSaveMaterial} onRemove={onRemoveMaterial} />
    {detailBounds ? <TubeSectionDetailDrawer section={detailBounds.section} start={detailBounds.start} end={detailBounds.end} materials={materials} inspector={detailInspector} onChange={(section) => updateSection(section.id, section)} /> : null}
    <DeleteConfirmationDialog open={Boolean(pendingSectionDeleteId)} title="パイプセクションを削除" description={`「${pendingSectionDeleteId ?? ""}」を構造案から削除します。`} onCancel={() => setPendingSectionDeleteId(null)} onConfirm={() => { if (pendingSectionDeleteId) onSaveDesign({ ...design, sections: design.sections.filter((item) => item.id !== pendingSectionDeleteId) }); setPendingSectionDeleteId(null); }} />
  </div>;
}

function MaterialLibrary({ designs, materials, onSave, onRemove }: { designs: readonly StructuralDesign[]; materials: readonly CarbonMaterial[]; onSave: (material: CarbonMaterial) => void; onRemove: (id: string) => void }) {
  const [drawerState, setDrawerState] = useState<InspectorState<string>>({ open: false, mode: "edit", targetId: null });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const drawerMaterial = materials.find((material) => material.id === drawerState.targetId);
  const inspector: InspectorController<string> = {
    state: drawerState,
    openDetail: (id) => setDrawerState({ open: true, mode: "detail", targetId: id }),
    openCreate: () => setDrawerState({ open: true, mode: "create", targetId: null }),
    openEdit: (id) => setDrawerState({ open: true, mode: "edit", targetId: id }),
    close: () => setDrawerState((current) => ({ ...current, open: false })),
  };
  const referenceCount = materialReferenceCount(designs, pendingDeleteId);
  const add = () => { const material = createDefaultMaterial(); onSave(material); inspector.openEdit(material.id); };

  return <>
    <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">カーボン材料ライブラリ</h2><p className="mt-1 text-sm text-slate-500">値はSI単位で保存されます。実材料の試験値を使用してください。</p></div><Button size="sm" onClick={add}><Plus size={15} />材料</Button></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">名称</th><th>E1</th><th>E2</th><th>G12</th><th>層厚</th><th>密度</th><th>低減係数</th><th className="text-right">操作</th></tr></thead><tbody>
      {materials.map((material) => <tr key={material.id} className={`border-t ${drawerState.open && material.id === drawerState.targetId ? "bg-blue-50" : ""}`}><td className="px-2 py-3 font-medium">{material.name}</td><td>{formatGPa(material.e1)}</td><td>{formatGPa(material.e2)}</td><td>{formatGPa(material.g12)}</td><td>{(material.plyThickness * 1000).toFixed(3)} mm</td><td>{material.density} kg/m³</td><td>{material.reductionFactor.toFixed(2)}</td><td className="text-right"><RowActions entityLabel={material.name} edit={{ onAction: () => inspector.openEdit(material.id) }} delete={{ onAction: () => setPendingDeleteId(material.id) }} /></td></tr>)}
    </tbody></table></div></CardBody></Card>
    {drawerMaterial ? <MaterialPropertyDrawer material={drawerMaterial} inspector={inspector} onChange={onSave} /> : null}
    <DeleteConfirmationDialog open={Boolean(pendingDeleteId)} title="材料を削除" description={`「${materials.find((material) => material.id === pendingDeleteId)?.name ?? ""}」を材料ライブラリから削除します。`} blockedReason={referenceCount ? `${referenceCount}本のパイプセクションで使用中のため削除できません。` : undefined} onCancel={() => setPendingDeleteId(null)} onConfirm={() => { if (pendingDeleteId) onRemove(pendingDeleteId); setPendingDeleteId(null); }} />
  </>;
}

function SupportEditor({ design, onSave }: { design: StructuralDesign; onSave: (design: StructuralDesign) => void }) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const supports = design.supports ?? [];
  const span = structuralSpan(design);
  const update = (id: string, patch: Partial<NonNullable<StructuralDesign["supports"]>[number]>) => onSave({ ...design, supports: supports.map((support) => support.id === id ? { ...support, ...patch } : support) });
  const pendingIndex = supports.findIndex((support) => support.id === pendingDeleteId);

  return <>
    <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">支持点・張線</h2><p className="mt-1 text-sm text-slate-500">剛支持または張線・支柱を等価ばね剛性でモデル化します。</p></div><Button size="sm" onClick={() => onSave({ ...design, supports: [...supports, { id: createStructuralId("support"), yPosition: span / 2, kind: "rigid" }] })}><Plus size={15} />支持点</Button></CardHeader><CardBody>{supports.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置</th><th>種類</th><th>等価剛性 N/m</th><th className="text-right">操作</th></tr></thead><tbody>
      {supports.map((support, index) => <tr key={support.id} className="border-t"><td className="px-2 py-2"><input aria-label={`支持点${index + 1}の位置`} type="number" value={support.yPosition} onChange={(event) => update(support.id, { yPosition: Number(event.target.value) })} className="h-8 w-24 rounded border px-2" /></td><td><select aria-label={`支持点${index + 1}の種類`} value={support.kind} onChange={(event) => update(support.id, { kind: event.target.value as "rigid" | "elastic", stiffness: event.target.value === "elastic" ? support.stiffness ?? 100000 : undefined })} className="h-8 rounded border bg-white px-2"><option value="rigid">剛支持</option><option value="elastic">張線・支柱</option></select></td><td>{support.kind === "elastic" ? <input aria-label={`支持点${index + 1}の剛性`} type="number" value={support.stiffness ?? 100000} onChange={(event) => update(support.id, { stiffness: Number(event.target.value) })} className="h-8 w-32 rounded border px-2" /> : "—"}</td><td className="text-right"><RowActions entityLabel={`支持点${index + 1}`} delete={{ onAction: () => setPendingDeleteId(support.id) }} /></td></tr>)}
    </tbody></table></div> : <p className="text-sm text-slate-500">支持点がない場合は翼根固定の片持ち梁として解析します。</p>}</CardBody></Card>
    <DeleteConfirmationDialog open={Boolean(pendingDeleteId)} title="支持点を削除" description={`支持点${pendingIndex + 1}を削除します。`} onCancel={() => setPendingDeleteId(null)} onConfirm={() => { if (pendingDeleteId) onSave({ ...design, supports: supports.filter((item) => item.id !== pendingDeleteId) }); setPendingDeleteId(null); }} />
  </>;
}

function SparPreview({ design, selectedId, onSelect }: { design: StructuralDesign; selectedId?: string; onSelect: (id: string) => void }) {
  const span = structuralSpan(design) || 1;
  return <svg viewBox="0 0 800 220" className="h-56 w-full" role="img" aria-label="主翼パイプ配置"><path d="M 40 110 L 760 185 L 760 45 Z" fill="#eff6ff" stroke="#93c5fd" />{tubeSectionBounds(design.sections).map(({ section, start, end }) => { const x1 = 40 + start / span * 720; const x2 = 40 + end / span * 720; const width = Math.max(5, section.outerDiameter * 100); return <g key={section.id} role="button" aria-label={`${section.id}を選択`} onClick={() => onSelect(section.id)} className="cursor-pointer"><line x1={x1} y1="112" x2={x2} y2="112" stroke={section.id === selectedId ? "#2563eb" : "#475569"} strokeWidth={width} /><line x1={x1} y1={112 - width / 2} x2={x1} y2={112 + width / 2} stroke="white" /><text x={(x1 + x2) / 2} y="148" textAnchor="middle" fontSize="12" fill="#475569">{section.length.toFixed(2)} m</text></g>; })}</svg>;
}

function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: number) => void }) { return <label className="block text-sm"><span className="mb-1 block text-xs text-slate-500">{label}</span><span className="flex items-center gap-2"><input aria-label={label} type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 min-w-0 flex-1 rounded border px-2" /><span className="text-xs text-slate-500">{unit}</span></span></label>; }
function ReadValue({ label, value }: { label: string; value: string }) { return <div className="rounded border px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
function layupLabel(plies: readonly LaminatePly[]) { return `[${plies.map((ply) => `${ply.angle}°×${ply.count}`).join(" / ")}]`; }
function formatGPa(value: number) { return `${(value / 1e9).toFixed(1)} GPa`; }
