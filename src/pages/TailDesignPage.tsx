import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TailPreview } from "../features/aircraft/components/TailPreview";
import { deriveTailGeometry, validateTailSurface } from "../features/aircraft/model/tailGeometry";
import { alignSectionsToStraightSpar, DEFAULT_SPAR_CHORD_FRACTION, isValidSparChordFraction } from "../features/aircraft/model/sparGeometry";
import type { AircraftGeometry, PanelDistribution, TailSurface, TailSurfaceOrientation, TailSurfaceSection } from "../features/aircraft/model/types";
import type { Airfoil } from "../features/airfoils/model/types";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";
import { OrderedEntityTable, type OrderedTableColumn } from "../shared/ui/table/OrderedEntityTable";
import { RowActions } from "../shared/ui/table/RowActions";
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

interface TailDesignPageProps {
  aircraft: AircraftGeometry;
  airfoils: readonly Airfoil[];
  onUpdateAircraft: (patch: Partial<AircraftGeometry>) => void;
}

export function TailDesignPage({ aircraft, airfoils, onUpdateAircraft }: TailDesignPageProps) {
  const navigate = useNavigate();
  const initialSurfaces = useMemo(() => (aircraft.tailSurfaces ?? []).map(cloneTail), [aircraft.tailSurfaces]);
  const [drafts, setDrafts] = useState<TailSurface[]>(initialSurfaces);
  const [selectedSections, setSelectedSections] = useState<Record<string, string | null>>(() => initialSelection(initialSurfaces));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const airfoilIds = useMemo(() => new Set(airfoils.map((airfoil) => airfoil.id)), [airfoils]);

  useEffect(() => {
    setDrafts(initialSurfaces);
    setSelectedSections(initialSelection(initialSurfaces));
  }, [initialSurfaces]);

  const validation = drafts.map((surface) => ({ id: surface.id, errors: validateTailSurface(surface, airfoilIds) }));
  const valid = validation.every((result) => result.errors.length === 0);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(initialSurfaces);
  const preview = { ...aircraft, tailSurfaces: drafts };

  const addTail = () => {
    const surface = createDefaultTail(airfoils[0]?.id ?? "", nextTailName(drafts));
    setDrafts((current) => [...current, surface]);
    setSelectedSections((current) => ({ ...current, [surface.id]: surface.sections[0]?.id ?? null }));
  };
  const updateTail = (surface: TailSurface) => setDrafts((current) => current.map((item) => item.id === surface.id ? surface : item));
  const reset = () => {
    setDrafts(initialSurfaces.map(cloneTail));
    setSelectedSections(initialSelection(initialSurfaces));
  };
  const save = () => {
    if (!dirty || !valid) return;
    onUpdateAircraft({ tailSurfaces: drafts.map(cloneTail) });
  };
  const remove = () => {
    if (!pendingDeleteId) return;
    setDrafts((current) => current.filter((surface) => surface.id !== pendingDeleteId));
    setSelectedSections((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== pendingDeleteId)));
    setPendingDeleteId(null);
  };

  return <PageTemplate
    title="尾翼設計"
    description="XFLR5のELEVATOR・FINと同じセクション構成で、尾翼を主翼形状とは独立して定義します。"
    actions={<>
      <Button variant="secondary" disabled={!dirty} onClick={reset}>キャンセル</Button>
      <Button aria-label="尾翼設計を保存" disabled={!dirty || !valid} onClick={save}><Save size={16} />保存</Button>
      <Button disabled={dirty || !valid} title={dirty ? "変更を保存してから解析へ進んでください" : undefined} onClick={() => navigate("/stability")}>安定性設計に進む</Button>
    </>}
    tabs={<AerodynamicDesignTabs />}
    notices={!valid ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">入力を修正してから尾翼設計を保存してください。</div> : null}
  >
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">尾翼配置プレビュー</h2><p className="mt-1 text-sm text-slate-500">主翼と尾翼を同じ縮尺で表示し、機体座標上の配置を確認します。</p></div><Badge tone={drafts.length ? "blue" : "slate"}>{drafts.length} 面</Badge></CardHeader>
        <CardBody><TailPreview aircraft={preview} /></CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">尾翼面</h2><p className="mt-1 text-sm text-slate-500">尾翼ごとに、取付位置とXFLR5翼面セクションを直接編集します。</p></div><Button size="sm" onClick={addTail}><Plus size={15} />尾翼を追加</Button></CardHeader>
        {!drafts.length ? <CardBody><div className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">尾翼はまだ定義されていません。追加すると、この場所に設計テーブルが表示されます。</div></CardBody> : null}
      </Card>

      {drafts.map((surface) => <TailSurfaceEditor
        key={surface.id}
        surface={surface}
        airfoils={airfoils}
        errors={validation.find((result) => result.id === surface.id)?.errors ?? []}
        selectedSectionId={selectedSections[surface.id] ?? surface.sections[0]?.id ?? null}
        onSelectSection={(sectionId) => setSelectedSections((current) => ({ ...current, [surface.id]: sectionId }))}
        onChange={updateTail}
        onRequestDelete={() => setPendingDeleteId(surface.id)}
      />)}
    </div>

    <DeleteConfirmationDialog open={pendingDeleteId !== null} title="尾翼を削除しますか？" description="この尾翼面とすべてのセクション設定が、保存時に設計から削除されます。" onConfirm={remove} onCancel={() => setPendingDeleteId(null)} />
  </PageTemplate>;
}

function TailSurfaceEditor({ surface, airfoils, errors, selectedSectionId, onSelectSection, onChange, onRequestDelete }: {
  surface: TailSurface;
  airfoils: readonly Airfoil[];
  errors: readonly string[];
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  onChange: (surface: TailSurface) => void;
  onRequestDelete: () => void;
}) {
  const [pendingSectionDeleteId, setPendingSectionDeleteId] = useState<string | null>(null);
  const metrics = deriveTailGeometry(surface);
  const updateRootPosition = (axis: "x" | "y" | "z", value: number) => onChange({ ...surface, rootPosition: { ...surface.rootPosition, [axis]: value } });
  const sparChordFraction = surface.sparChordFraction ?? DEFAULT_SPAR_CHORD_FRACTION;
  const updateSection = (sectionId: string, patch: Partial<TailSurfaceSection>) => onChange({ ...surface, sections: sortTailSections(surface.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section), surface.sections[0]?.id) });
  const setOrientation = (orientation: TailSurfaceOrientation) => onChange({
    ...surface,
    orientation,
    name: isDefaultTailName(surface.name) ? orientationLabel(orientation) : surface.name,
    symmetric: orientation === "horizontal",
    isDoubleFin: false,
    isSymmetricFin: false,
  });
  const insertAfter = (sectionId: string) => {
    const index = surface.sections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;
    const next = insertTailSection(surface.sections, index);
    onSelectSection(next[index + 1].id);
    onChange({ ...surface, sections: next });
  };
  const insertBefore = (sectionId: string) => {
    const index = surface.sections.findIndex((section) => section.id === sectionId);
    if (index < 0) return;
    if (index > 0) return insertAfter(surface.sections[index - 1].id);
    const root = surface.sections[0];
    const next = surface.sections[1];
    if (!root || !next) return;
    const newRoot = { ...root, id: createTailSectionId() };
    const shiftedRoot = { ...root, spanPosition: interpolate(root.spanPosition, next.spanPosition, 0.5) };
    onSelectSection(shiftedRoot.id);
    onChange({ ...surface, sections: [newRoot, shiftedRoot, ...surface.sections.slice(2)] });
  };
  const removeSection = () => {
    if (!pendingSectionDeleteId) return;
    onChange({ ...surface, sections: surface.sections.filter((section) => section.id !== pendingSectionDeleteId) });
    onSelectSection(surface.sections[0]?.id ?? "");
    setPendingSectionDeleteId(null);
  };
  const columns: OrderedTableColumn<TailSurfaceSection>[] = [
    { key: "span", header: surface.orientation === "vertical" ? "Z Position" : "Y Position", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} ${surface.orientation === "vertical" ? "Z" : "Y"} position`} value={surface.orientation === "vertical" ? Number((surface.rootPosition.z + section.spanPosition).toFixed(6)) : section.spanPosition} disabled={index === 0} onChange={(value) => updateSection(section.id, { spanPosition: surface.orientation === "vertical" ? value - surface.rootPosition.z : value })} /> },
    { key: "chord", header: "Chord", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} chord`} value={section.chord} onChange={(value) => updateSection(section.id, { chord: value })} /> },
    { key: "offset", header: "X Offset", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} X offset`} value={section.xOffset} onChange={(value) => updateSection(section.id, { xOffset: value })} /> },
    { key: "dihedral", header: "Dihedral", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} dihedral`} value={section.dihedral} step={0.1} onChange={(value) => updateSection(section.id, { dihedral: value })} /> },
    { key: "twist", header: "Twist", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} twist`} value={section.twist} step={0.1} onChange={(value) => updateSection(section.id, { twist: value })} /> },
    { key: "right-foil", header: "Right Foil", renderCell: (section, index) => <FoilSelect label={`${surface.name} section ${index + 1} right foil`} value={section.rightAirfoilId} airfoils={airfoils} onChange={(value) => updateSection(section.id, { rightAirfoilId: value, ...(surface.symmetric ? { leftAirfoilId: value } : {}) })} /> },
    { key: "left-foil", header: "Left Foil", renderCell: (section, index) => <FoilSelect label={`${surface.name} section ${index + 1} left foil`} value={section.leftAirfoilId} airfoils={airfoils} disabled={surface.symmetric} onChange={(value) => updateSection(section.id, { leftAirfoilId: value })} /> },
    { key: "x-panels", header: "X Panels", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} X panels`} value={section.chordwisePanels} step={1} onChange={(value) => updateSection(section.id, { chordwisePanels: value })} /> },
    { key: "x-dist", header: "X Dist", renderCell: (section, index) => <DistributionSelect label={`${surface.name} section ${index + 1} X distribution`} value={section.chordwiseDistribution} onChange={(value) => updateSection(section.id, { chordwiseDistribution: value })} /> },
    { key: "y-panels", header: "Y Panels", renderCell: (section, index) => <NumericCell label={`${surface.name} section ${index + 1} Y panels`} value={section.spanwisePanels} step={1} onChange={(value) => updateSection(section.id, { spanwisePanels: value })} /> },
    { key: "y-dist", header: "Y Dist", renderCell: (section, index) => <DistributionSelect label={`${surface.name} section ${index + 1} Y distribution`} value={section.spanwiseDistribution} onChange={(value) => updateSection(section.id, { spanwiseDistribution: value })} /> },
  ];

  return <section aria-labelledby={`${surface.id}-title`} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><h2 id={`${surface.id}-title`} className="text-lg font-semibold text-slate-950">{surface.name}</h2><Badge tone="blue">{xflr5Type(surface.orientation)}</Badge></div>
      <Button size="sm" variant="destructive" aria-label={`${surface.name}を削除`} onClick={onRequestDelete}><Trash2 size={15} />尾翼を削除</Button>
    </div>

    <Card>
      <CardHeader><h3 className="font-semibold text-slate-950">尾翼プロパティ</h3><p className="mt-1 text-xs text-slate-500">主翼設計と同様に、変更内容はページ上部の保存操作で確定します。</p></CardHeader>
      <CardBody>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TextInput label="名称" value={surface.name} onChange={(value) => onChange({ ...surface, name: value })} />
          <label className="grid gap-1 text-sm text-slate-700"><span>種類</span><select aria-label={`${surface.name}の種類`} className="rounded-md border border-slate-300 px-3 py-2" value={surface.orientation} onChange={(event) => setOrientation(event.target.value as TailSurfaceOrientation)}><option value="horizontal">水平尾翼</option><option value="vertical">垂直尾翼</option></select></label>
          <NumberInput label="翼根前縁X位置" value={surface.rootPosition.x} unit="m" onChange={(value) => updateRootPosition("x", value)} />
          <NumberInput label="取付Y位置" value={surface.rootPosition.y} unit="m" onChange={(value) => updateRootPosition("y", value)} />
          <NumberInput label="取付Z位置" value={surface.rootPosition.z} unit="m" onChange={(value) => updateRootPosition("z", value)} />
          <NumberInput label="取付角" value={surface.incidence} unit="°" onChange={(value) => onChange({ ...surface, incidence: value })} />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={surface.symmetric} onChange={(event) => onChange({ ...surface, symmetric: event.target.checked, sections: event.target.checked ? surface.sections.map((section) => ({ ...section, leftAirfoilId: section.rightAirfoilId })) : surface.sections })} />左右翼型を対称にする</label>
          {surface.orientation === "vertical" ? <><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={surface.isDoubleFin} onChange={(event) => onChange({ ...surface, isDoubleFin: event.target.checked, isSymmetricFin: event.target.checked ? surface.isSymmetricFin : false })} />Double Fin</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={surface.isSymmetricFin} disabled={!surface.isDoubleFin} onChange={(event) => onChange({ ...surface, isSymmetricFin: event.target.checked })} />Symmetric Fin</label></> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-slate-700">{surface.name}の桁位置 (%翼弦)
            <input aria-label={`${surface.name}の桁位置 (%翼弦)`} type="number" min="0" max="100" step="1" value={sparChordFraction * 100} onChange={(event) => onChange({ ...surface, sparChordFraction: Number(event.target.value) / 100 })} className="w-36 rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <Button variant="secondary" disabled={!isValidSparChordFraction(sparChordFraction)} aria-label={`${surface.name}の桁を直線に揃える`} onClick={() => onChange({ ...surface, sections: alignSectionsToStraightSpar(surface.sections, sparChordFraction) })}>桁を直線に揃える</Button>
          <p className="text-xs text-slate-500">直線に揃えると各断面の X Offset を更新します。</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyValue label="面積" value={`${metrics.area.toFixed(3)} m²`} />
          <ReadOnlyValue label="スパン／高さ" value={`${metrics.span.toFixed(3)} m`} />
          <ReadOnlyValue label="投影面積" value={`${metrics.projectedArea.toFixed(3)} m²`} />
          <ReadOnlyValue label="MAC" value={`${metrics.meanAerodynamicChord.toFixed(3)} m`} />
        </div>
      </CardBody>
    </Card>

    <OrderedEntityTable title={`${surface.name}セクション`} description="翼根から翼端へ、XFLR5 Wing Editionと同じ列で定義します。" itemLabel="セクション" items={surface.sections} columns={columns} getKey={(section) => section.id} getRowLabel={(_, index) => `${surface.name} Section ${index + 1}`} selectedKey={selectedSectionId} onSelect={onSelectSection} insertBefore={{ onAction: insertBefore }} insertAfter={{ onAction: insertAfter }} renderActions={(section, index) => <RowActions entityLabel={`${surface.name} Section ${index + 1}`} delete={{ disabled: index === 0 || surface.sections.length <= 2, disabledReason: index === 0 ? "ルート断面は削除できません" : surface.sections.length <= 2 ? "尾翼には2断面以上必要です" : undefined, onAction: () => setPendingSectionDeleteId(section.id) }} />} minWidthClassName="min-w-[1420px]" footer={<>{errors.length ? <ul role="alert" className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<p className="mt-3 text-sm text-blue-800">エレベーター・ラダーは桁軸まわりに尾翼全体を回転する全遊動モデルです。取付角を変更して評価します。回転軸は翼根の桁位置を通るスパン軸で固定し、空力中心と一致する前提です。</p></>} />

    <DeleteConfirmationDialog open={pendingSectionDeleteId !== null} title="尾翼セクションを削除しますか？" description="隣接するセクション同士が新しい翼パネルとして接続されます。" onCancel={() => setPendingSectionDeleteId(null)} onConfirm={removeSection} />
  </section>;
}

function createDefaultTail(airfoilId: string, name = "水平尾翼"): TailSurface {
  const id = `tail-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
  return { id, name, orientation: "horizontal", rootPosition: { x: 4, y: 0, z: 0.2 }, incidence: 0, sparChordFraction: DEFAULT_SPAR_CHORD_FRACTION, symmetric: true, isDoubleFin: false, isSymmetricFin: false, sections: [
    { id: `${id}-root`, spanPosition: 0, chord: 0.8, xOffset: 0, dihedral: 0, twist: 0, leftAirfoilId: airfoilId, rightAirfoilId: airfoilId, chordwisePanels: 8, spanwisePanels: 6, chordwiseDistribution: "cosine", spanwiseDistribution: "cosine" },
    { id: `${id}-tip`, spanPosition: 1.5, chord: 0.4, xOffset: 0.2, dihedral: 0, twist: 0, leftAirfoilId: airfoilId, rightAirfoilId: airfoilId, chordwisePanels: 8, spanwisePanels: 1, chordwiseDistribution: "cosine", spanwiseDistribution: "uniform" },
  ] };
}

function initialSelection(surfaces: readonly TailSurface[]) { return Object.fromEntries(surfaces.map((surface) => [surface.id, surface.sections[0]?.id ?? null])); }
function nextTailName(surfaces: readonly TailSurface[]) { let index = 1; let name = "水平尾翼"; const names = new Set(surfaces.map((surface) => surface.name)); while (names.has(name)) { index += 1; name = `水平尾翼 ${index}`; } return name; }
function cloneTail(surface: TailSurface): TailSurface { return { ...surface, rootPosition: { ...surface.rootPosition }, sections: surface.sections.map((section) => ({ ...section })) }; }
function isDefaultTailName(value: string) { return /^(水平尾翼|垂直尾翼)( \d+)?$/.test(value); }
function orientationLabel(value: TailSurfaceOrientation) { return value === "horizontal" ? "水平尾翼" : "垂直尾翼"; }
function xflr5Type(value: TailSurfaceOrientation) { return value === "horizontal" ? "ELEVATOR" : "FIN"; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-1 text-sm text-slate-700"><span>{label}</span><input aria-label={`${value}の${label}`} className="rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function NumberInput({ label, value, unit, onChange }: { label: string; value: number; unit?: string; onChange: (value: number) => void }) { return <label className="grid gap-1 text-sm text-slate-700"><span>{label}{unit ? ` (${unit})` : ""}</span><input aria-label={`${label} (${unit ?? ""})`} type="number" step="0.01" className="rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function ReadOnlyValue({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 bg-white px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>; }
function NumericCell({ label, value, step = 0.01, disabled = false, onChange }: { label: string; value: number; step?: number; disabled?: boolean; onChange: (value: number) => void }) { return <input aria-label={label} type="number" step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-20 rounded border border-slate-200 px-2 disabled:bg-slate-100" />; }
function FoilSelect({ label, value, airfoils, disabled = false, onChange }: { label: string; value: string; airfoils: readonly Airfoil[]; disabled?: boolean; onChange: (value: string) => void }) { return <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-9 min-w-32 rounded border border-slate-200 px-2 disabled:bg-slate-100">{!airfoils.some((airfoil) => airfoil.id === value) ? <option value={value} disabled>未登録の翼型 ({value})</option> : null}{airfoils.map((airfoil) => <option key={airfoil.id} value={airfoil.id}>{airfoil.name}</option>)}</select>; }
function DistributionSelect({ label, value, onChange }: { label: string; value: PanelDistribution; onChange: (value: PanelDistribution) => void }) { return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as PanelDistribution)} className="h-9 rounded border border-slate-200 px-2"><option value="uniform">Uniform</option><option value="cosine">Cosine</option><option value="sine">Sine</option><option value="inverse-sine">-Sine</option></select>; }
function insertTailSection(sections: readonly TailSurfaceSection[], index: number) { const root = sections[index]; const tip = sections[index + 1]; const previous = sections[index - 1]; const distance = Math.max(0.1, root.spanPosition - (previous?.spanPosition ?? 0) || 1); const ratio = tip ? 0.5 : 1; const section: TailSurfaceSection = { ...root, id: createTailSectionId(), spanPosition: tip ? interpolate(root.spanPosition, tip.spanPosition, ratio) : root.spanPosition + distance, chord: tip ? interpolate(root.chord, tip.chord, ratio) : root.chord, xOffset: tip ? interpolate(root.xOffset, tip.xOffset, ratio) : root.xOffset, dihedral: root.dihedral, twist: tip ? interpolate(root.twist, tip.twist, ratio) : root.twist }; return [...sections.slice(0, index + 1), section, ...sections.slice(index + 1)]; }
function sortTailSections(sections: TailSurfaceSection[], rootId: string | undefined) { return [...sections].sort((left, right) => left.id === rootId ? -1 : right.id === rootId ? 1 : left.spanPosition - right.spanPosition); }
function interpolate(start: number, end: number, ratio: number) { return start + (end - start) * ratio; }
function createTailSectionId() { return `tail-section-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`; }
