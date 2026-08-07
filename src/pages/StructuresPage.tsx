import { Download, Pencil, Plus, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { AnalysisResult } from "../features/analysis/model/types";
import type { CarbonMaterial, LaminatePly, StructuralAnalysisResult, StructuralDesign, StructuralLoadCase, StructuralTubeSection } from "../features/structures/model/types";
import { MaterialPropertyDrawer } from "../features/structures/components/MaterialPropertyDrawer";
import { TubeSectionDetailDrawer } from "../features/structures/components/TubeSectionDetailDrawer";
import { calculateLaminate, executeStructuralAnalysis } from "../features/structures/services/structuralAnalysis";
import { createLoadCaseFromAerodynamicResult, createStructuralResultCsv, createStructuralSummary } from "../features/structures/services/structuralLoadService";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import type { InspectorController, InspectorState } from "../shared/model";
import { RowActions } from "../shared/ui/table/RowActions";

interface StructuresPageProps {
  aircraft: AircraftGeometry;
  aerodynamicResults: readonly AnalysisResult[];
  materials: readonly CarbonMaterial[];
  designs: readonly StructuralDesign[];
  results: readonly StructuralAnalysisResult[];
  onSaveMaterial: (material: CarbonMaterial) => void;
  onRemoveMaterial: (materialId: string) => void;
  onSaveDesign: (design: StructuralDesign) => void;
  onRemoveDesign: (designId: string) => void;
  onSaveResult: (result: StructuralAnalysisResult) => void;
}

type Tab = "設計" | "荷重ケース" | "結果";

export function StructuresPage(props: StructuresPageProps) {
  const { aircraft, aerodynamicResults, materials, designs, results, onSaveMaterial, onRemoveMaterial, onSaveDesign, onRemoveDesign, onSaveResult } = props;
  const [activeTab, setActiveTab] = useState<Tab>("設計");
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(designs[0]?.id ?? null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(designs[0]?.sections[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!designs.some((design) => design.id === selectedDesignId)) setSelectedDesignId(designs[0]?.id ?? null);
  }, [designs, selectedDesignId]);
  const design = designs.find((item) => item.id === selectedDesignId) ?? designs[0];
  const designResults = results.filter((result) => result.designId === design?.id);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const result = designResults.find((item) => item.id === selectedResultId) ?? designResults[0];

  const saveDesign = (next: StructuralDesign) => {
    setError(null);
    onSaveDesign(next);
  };

  const run = (loadCase: StructuralLoadCase) => {
    if (!design) return;
    try {
      const next = executeStructuralAnalysis({ design, loadCase, materials, resultId: createId("structural-result") });
      onSaveResult(next);
      setSelectedResultId(next.id);
      setActiveTab("結果");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "構造解析に失敗しました。");
    }
  };

  return <PageTemplate
    title="主翼カーボンパイプ構造設計"
    description="円形積層管の剛性、重量、たわみ、ねじれ、最大応力リザーブファクターを評価します。"
    actions={<>
        <select aria-label="構造設計" value={design?.id ?? ""} onChange={(event) => setSelectedDesignId(event.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm">{designs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Button variant="secondary" onClick={() => {
          const next = createDefaultDesign(aircraft, materials[0]);
          onSaveDesign(next); setSelectedDesignId(next.id);
        }}><Plus size={16} />構造案</Button>
        {design ? <Button variant="destructive" size="icon" aria-label={`${design.name}を削除`} title={`${design.name}を削除`} onClick={() => onRemoveDesign(design.id)}><Trash2 size={16} /></Button> : null}
    </>}
    tabs={<div role="tablist" className="flex border-b border-slate-200">{(["設計", "荷重ケース", "結果"] as const).map((tab) => <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>{tab}</button>)}</div>}
    notices={error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
  >
    {!design ? <EmptyDesign onCreate={() => onSaveDesign(createDefaultDesign(aircraft, materials[0]))} /> : activeTab === "設計"
      ? <DesignTab design={design} materials={materials} selectedSectionId={selectedSectionId} onSelectSection={setSelectedSectionId} onSaveDesign={saveDesign} onSaveMaterial={onSaveMaterial} onRemoveMaterial={onRemoveMaterial} />
      : activeTab === "荷重ケース"
        ? <LoadsTab design={design} aircraft={aircraft} aerodynamicResults={aerodynamicResults} onSaveDesign={saveDesign} onRun={run} />
        : <ResultsTab results={designResults} result={result} onSelectResult={setSelectedResultId} />}
  </PageTemplate>;
}

function DesignTab({ design, materials, selectedSectionId, onSelectSection, onSaveDesign, onSaveMaterial, onRemoveMaterial }: { design: StructuralDesign; materials: readonly CarbonMaterial[]; selectedSectionId: string | null; onSelectSection: (id: string) => void; onSaveDesign: (design: StructuralDesign) => void; onSaveMaterial: (material: CarbonMaterial) => void; onRemoveMaterial: (id: string) => void }) {
  const [detailState, setDetailState] = useState<InspectorState<string>>({ open: false, mode: "detail", targetId: null });
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
    <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">CFRPパイプセクション</h2><p className="mt-1 text-sm text-slate-500">各セクションは指定長さの全域で同じ外径・積層構成です。線形補間は行いません。</p></div><Button size="sm" onClick={() => { const section = createTubeSection(materials[0]); onSaveDesign({ ...design, sections: [...design.sections, section] }); onSelectSection(section.id); }} disabled={!materials.length}><Plus size={15} />セクション</Button></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">範囲</th><th>長さ</th><th>外径</th><th>積層</th><th className="text-right">操作</th></tr></thead><tbody>{bounds.map(({ section, start, end }) => <tr key={section.id} className={`border-t ${section.id === selected?.id ? "bg-blue-50" : ""}`} onClick={() => onSelectSection(section.id)}><td className="px-2 py-2">{start.toFixed(3)}–{end.toFixed(3)} m</td><td>{section.length.toFixed(3)} m</td><td>{(section.outerDiameter * 1000).toFixed(1)} mm</td><td>{layupLabel(section.plies)}</td><td className="text-right"><RowActions entityLabel={section.id} detail={{ active: detailState.open && detailState.targetId === section.id, onAction: () => { onSelectSection(section.id); detailInspector.openDetail(section.id); } }} delete={{ disabled: design.sections.length <= 1, disabledReason: design.sections.length <= 1 ? "最低1本のパイプが必要です" : undefined, onAction: () => onSaveDesign({ ...design, sections: design.sections.filter((item) => item.id !== section.id) }) }} /></td></tr>)}</tbody></table></div></CardBody></Card>
    <SupportEditor design={design} onSave={onSaveDesign} />
    <MaterialLibrary materials={materials} onSave={onSaveMaterial} onRemove={onRemoveMaterial} />
    {detailBounds ? <TubeSectionDetailDrawer section={detailBounds.section} start={detailBounds.start} end={detailBounds.end} materials={materials} inspector={detailInspector} onChange={(section) => updateSection(section.id, section)} /> : null}
  </div>;
}

function MaterialLibrary({ materials, onSave, onRemove }: { materials: readonly CarbonMaterial[]; onSave: (material: CarbonMaterial) => void; onRemove: (id: string) => void }) {
  const [drawerState, setDrawerState] = useState<InspectorState<string>>({ open: false, mode: "edit", targetId: null });
  const drawerMaterial = materials.find((material) => material.id === drawerState.targetId);
  const inspector: InspectorController<string> = {
    state: drawerState,
    openDetail: (id) => setDrawerState({ open: true, mode: "detail", targetId: id }),
    openCreate: () => setDrawerState({ open: true, mode: "create", targetId: null }),
    openEdit: (id) => setDrawerState({ open: true, mode: "edit", targetId: id }),
    close: () => setDrawerState((current) => ({ ...current, open: false })),
  };
  const add = () => { const material = createDefaultMaterial(); onSave(material); inspector.openEdit(material.id); };
  return <>
    <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">カーボン材料ライブラリ</h2><p className="mt-1 text-sm text-slate-500">値はSI単位で保存されます。実材料の試験値を使用してください。</p></div><Button size="sm" onClick={add}><Plus size={15} />材料</Button></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">名称</th><th>E1</th><th>E2</th><th>G12</th><th>層厚</th><th>密度</th><th>低減係数</th><th className="text-right">操作</th></tr></thead><tbody>{materials.map((material) => <tr key={material.id} className={`border-t ${drawerState.open && material.id === drawerState.targetId ? "bg-blue-50" : ""}`}><td className="px-2 py-3 font-medium">{material.name}</td><td>{formatGPa(material.e1)}</td><td>{formatGPa(material.e2)}</td><td>{formatGPa(material.g12)}</td><td>{(material.plyThickness * 1000).toFixed(3)} mm</td><td>{material.density} kg/m³</td><td>{material.reductionFactor.toFixed(2)}</td><td className="text-right"><div className="flex justify-end"><Button variant="ghost" size="icon" aria-label={`${material.name}を編集`} title={`${material.name}を編集`} onClick={() => inspector.openEdit(material.id)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label={`${material.name}を削除`} title={`${material.name}を削除`} onClick={() => onRemove(material.id)}><Trash2 size={15} /></Button></div></td></tr>)}</tbody></table></div></CardBody></Card>
    {drawerMaterial ? <MaterialPropertyDrawer material={drawerMaterial} inspector={inspector} onChange={onSave} /> : null}
  </>;
}

function SupportEditor({ design, onSave }: { design: StructuralDesign; onSave: (design: StructuralDesign) => void }) {
  const supports = design.supports ?? [];
  const span = structuralSpan(design);
  const update = (id: string, patch: Partial<NonNullable<StructuralDesign["supports"]>[number]>) => onSave({ ...design, supports: supports.map((support) => support.id === id ? { ...support, ...patch } : support) });
  return <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold">支持点・張線</h2><p className="mt-1 text-sm text-slate-500">剛支持または張線・支柱を等価ばね剛性でモデル化します。</p></div><Button size="sm" onClick={() => onSave({ ...design, supports: [...supports, { id: createId("support"), yPosition: span / 2, kind: "rigid" }] })}><Plus size={15} />支持点</Button></CardHeader><CardBody>{supports.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置</th><th>種類</th><th>等価剛性 N/m</th><th className="text-right">操作</th></tr></thead><tbody>{supports.map((support, index) => <tr key={support.id} className="border-t"><td className="px-2 py-2"><input aria-label={`支持点${index + 1}の位置`} type="number" value={support.yPosition} onChange={(event) => update(support.id, { yPosition: Number(event.target.value) })} className="h-8 w-24 rounded border px-2" /></td><td><select aria-label={`支持点${index + 1}の種類`} value={support.kind} onChange={(event) => update(support.id, { kind: event.target.value as "rigid" | "elastic", stiffness: event.target.value === "elastic" ? support.stiffness ?? 100000 : undefined })} className="h-8 rounded border bg-white px-2"><option value="rigid">剛支持</option><option value="elastic">張線・支柱</option></select></td><td>{support.kind === "elastic" ? <input aria-label={`支持点${index + 1}の剛性`} type="number" value={support.stiffness ?? 100000} onChange={(event) => update(support.id, { stiffness: Number(event.target.value) })} className="h-8 w-32 rounded border px-2" /> : "—"}</td><td className="text-right"><Button variant="ghost" size="icon" aria-label={`支持点${index + 1}を削除`} title={`支持点${index + 1}を削除`} onClick={() => onSave({ ...design, supports: supports.filter((item) => item.id !== support.id) })}><Trash2 size={15} /></Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">支持点がない場合は翼根固定の片持ち梁として解析します。</p>}</CardBody></Card>;
}

function LoadsTab({ design, aircraft, aerodynamicResults, onSaveDesign, onRun }: { design: StructuralDesign; aircraft: AircraftGeometry; aerodynamicResults: readonly AnalysisResult[]; onSaveDesign: (design: StructuralDesign) => void; onRun: (loadCase: StructuralLoadCase) => void }) {
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(design.loadCases[0]?.id ?? null);
  const selectedLoad = design.loadCases.find((loadCase) => loadCase.id === selectedLoadId) ?? design.loadCases[0];
  const update = (id: string, patch: Partial<StructuralLoadCase>) => onSaveDesign({ ...design, loadCases: design.loadCases.map((item) => item.id === id ? { ...item, ...patch, status: "needs-review" } : item) });
  const addManual = () => onSaveDesign({ ...design, loadCases: [...design.loadCases, { id: createId("load"), name: "手入力荷重", source: "manual", loadFactor: 1, safetyFactor: 1.5, distributedLoads: [{ yPosition: 0, liftPerLength: 100, torquePerLength: 0 }, { yPosition: structuralSpan(design) || aircraft.span / 2, liftPerLength: 0, torquePerLength: 0 }], pointLoads: [], status: "not-run" }] });
  return <div className="space-y-5">
      <Card><CardHeader className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">構造荷重ケース</h2><p className="mt-1 text-sm text-slate-500">荷重倍数と安全係数は解析荷重へ乗算されます。</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={addManual}><Plus size={15} />手入力</Button>{aerodynamicResults[0] ? <Button size="sm" onClick={() => onSaveDesign({ ...design, loadCases: [...design.loadCases, createLoadCaseFromAerodynamicResult({ result: aerodynamicResults[0], aircraft })] })}><Plus size={15} />空力結果から作成</Button> : null}</div></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">ケース</th><th>荷重源</th><th>荷重倍数</th><th>安全係数</th><th>最大分布荷重</th><th>状態</th><th className="text-right">操作</th></tr></thead><tbody>{design.loadCases.map((loadCase) => <tr key={loadCase.id} className={`border-t ${loadCase.id === selectedLoad?.id ? "bg-blue-50" : ""}`} onClick={() => setSelectedLoadId(loadCase.id)}><td className="px-2 py-3 font-medium">{loadCase.name}</td><td>{sourceLabel(loadCase.source)}</td><td><input aria-label={`${loadCase.name}の荷重倍数`} className="h-8 w-20 rounded border px-2" type="number" step="0.1" value={loadCase.loadFactor} onChange={(event) => update(loadCase.id, { loadFactor: Number(event.target.value) })} /></td><td><input aria-label={`${loadCase.name}の安全係数`} className="h-8 w-20 rounded border px-2" type="number" step="0.1" value={loadCase.safetyFactor} onChange={(event) => update(loadCase.id, { safetyFactor: Number(event.target.value) })} /></td><td>{Math.max(0, ...loadCase.distributedLoads.map((load) => load.liftPerLength)).toFixed(1)} N/m</td><td><Badge tone={loadCase.status === "completed" ? "green" : loadCase.status === "needs-review" ? "amber" : "slate"}>{statusLabel(loadCase.status)}</Badge></td><td className="text-right"><div className="flex justify-end gap-1"><Button size="sm" aria-label={`${loadCase.name}を解析`} onClick={() => onRun(loadCase)}><Play size={15} />解析</Button><Button variant="ghost" size="icon" aria-label={`${loadCase.name}を削除`} title={`${loadCase.name}を削除`} onClick={() => onSaveDesign({ ...design, loadCases: design.loadCases.filter((item) => item.id !== loadCase.id) })}><Trash2 size={15} /></Button></div></td></tr>)}</tbody></table>{!design.loadCases.length ? <p className="py-5 text-sm text-slate-500">荷重ケースを作成してください。</p> : null}</div></CardBody></Card>
    {selectedLoad ? <Card><CardHeader className="flex items-center justify-between"><h2 className="font-semibold">荷重点 — {selectedLoad.name}</h2><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => update(selectedLoad.id, { pointLoads: [...selectedLoad.pointLoads, { id: createId("point-load"), yPosition: structuralSpan(design) || aircraft.span / 2, force: 0, torque: 0 }] })}><Plus size={15} />集中荷重</Button><Button size="sm" onClick={() => update(selectedLoad.id, { distributedLoads: [...selectedLoad.distributedLoads, { yPosition: structuralSpan(design) || aircraft.span / 2, liftPerLength: 0, torquePerLength: 0 }] })}><Plus size={15} />分布荷重点</Button></div></CardHeader><CardBody className="space-y-4"><ResultChart points={selectedLoad.distributedLoads.map((load) => ({ x: load.yPosition, value: load.liftPerLength }))} label="分布荷重 N/m" /><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置 m</th><th>揚力 N/m</th><th>トルク Nm/m</th><th className="text-right">操作</th></tr></thead><tbody>{selectedLoad.distributedLoads.map((load, index) => <tr key={`${load.yPosition}-${index}`} className="border-t"><td className="px-2 py-2"><input aria-label={`荷重点${index + 1}の位置`} type="number" value={load.yPosition} onChange={(event) => updateLoadPoint(design, selectedLoad, index, { yPosition: Number(event.target.value) }, onSaveDesign)} className="h-8 w-24 rounded border px-2" /></td><td><input aria-label={`荷重点${index + 1}の揚力`} type="number" value={load.liftPerLength} onChange={(event) => updateLoadPoint(design, selectedLoad, index, { liftPerLength: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td><input aria-label={`荷重点${index + 1}のトルク`} type="number" value={load.torquePerLength} onChange={(event) => updateLoadPoint(design, selectedLoad, index, { torquePerLength: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td className="text-right"><Button variant="ghost" size="icon" aria-label={`荷重点${index + 1}を削除`} title={`荷重点${index + 1}を削除`} disabled={selectedLoad.distributedLoads.length <= 2} onClick={() => update(selectedLoad.id, { distributedLoads: selectedLoad.distributedLoads.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={15} /></Button></td></tr>)}</tbody></table></div>{selectedLoad.pointLoads.length ? <div className="overflow-x-auto"><h3 className="mb-2 text-sm font-semibold">集中荷重</h3><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置 m</th><th>荷重 N</th><th>トルク Nm</th><th className="text-right">操作</th></tr></thead><tbody>{selectedLoad.pointLoads.map((load, index) => <tr key={load.id} className="border-t"><td className="px-2 py-2"><input aria-label={`集中荷重${index + 1}の位置`} type="number" value={load.yPosition} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { yPosition: Number(event.target.value) }, onSaveDesign)} className="h-8 w-24 rounded border px-2" /></td><td><input aria-label={`集中荷重${index + 1}の荷重`} type="number" value={load.force} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { force: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td><input aria-label={`集中荷重${index + 1}のトルク`} type="number" value={load.torque} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { torque: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td className="text-right"><Button variant="ghost" size="icon" aria-label={`集中荷重${index + 1}を削除`} title={`集中荷重${index + 1}を削除`} onClick={() => update(selectedLoad.id, { pointLoads: selectedLoad.pointLoads.filter((item) => item.id !== load.id) })}><Trash2 size={15} /></Button></td></tr>)}</tbody></table></div> : null}</CardBody></Card> : null}
  </div>;
}

function ResultsTab({ results, result, onSelectResult }: { results: readonly StructuralAnalysisResult[]; result: StructuralAnalysisResult | undefined; onSelectResult: (id: string) => void }) {
  const [quantity, setQuantity] = useState<"shearForce" | "bendingMoment" | "torque" | "deflection" | "twist" | "minReserveFactor">("bendingMoment");
  const chart = useMemo(() => result?.points.map((point) => ({ x: point.yPosition, value: point[quantity] })) ?? [], [quantity, result]);
  if (!result) return <Card><CardBody><p className="text-sm text-slate-500">構造解析結果はまだありません。荷重ケースから解析を実行してください。</p></CardBody></Card>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><select aria-label="構造解析結果" value={result.id} onChange={(event) => onSelectResult(event.target.value)} className="h-9 rounded border bg-white px-3 text-sm">{results.map((item) => <option key={item.id} value={item.id}>{item.loadCaseSnapshot.name} / {new Date(item.createdAt).toLocaleString("ja-JP")}</option>)}</select><div className="flex gap-2"><Button variant="secondary" aria-label="構造結果CSVを保存" onClick={() => download(`${result.designSnapshot.name}.csv`, "text/csv;charset=utf-8", createStructuralResultCsv(result))}><Download size={16} />CSV</Button><Button variant="secondary" onClick={() => download(`${result.designSnapshot.name}.md`, "text/markdown;charset=utf-8", createStructuralSummary(result))}><Download size={16} />サマリー</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="最小RF" value={formatNumber(result.summary.minReserveFactor, 2)} detail={`${result.summary.governingPosition.toFixed(2)} m / ${result.summary.governingMode}`} /><MetricCard label="最大たわみ" value={`${(result.summary.maxDeflection * 1000).toFixed(1)} mm`} /><MetricCard label="最大ねじれ" value={`${(result.summary.maxTwist * 180 / Math.PI).toFixed(2)}°`} /><MetricCard label="パイプ重量" value={`${result.summary.mass.toFixed(3)} kg`} detail="片翼" /><MetricCard label="支配ケース" value={result.summary.governingLoadCase} detail={statusLabel(result.status)} /></div>
    <Card><CardHeader className="flex items-center justify-between"><h2 className="font-semibold">翼幅方向結果</h2><select aria-label="表示量" value={quantity} onChange={(event) => setQuantity(event.target.value as typeof quantity)} className="h-8 rounded border bg-white px-2 text-sm"><option value="shearForce">せん断力</option><option value="bendingMoment">曲げモーメント</option><option value="torque">ねじりモーメント</option><option value="deflection">たわみ</option><option value="twist">ねじれ</option><option value="minReserveFactor">リザーブファクター</option></select></CardHeader><CardBody><ResultChart points={chart} label={quantity} /></CardBody></Card>
    <Card><CardHeader><h2 className="font-semibold">断面別結果</h2></CardHeader><CardBody><div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white text-xs text-slate-500"><tr><th className="px-2 py-2">Y</th><th>荷重</th><th>せん断力</th><th>曲げ</th><th>たわみ</th><th>ねじれ</th><th>軸応力</th><th>せん断応力</th><th>RF</th><th>支配層</th></tr></thead><tbody>{result.points.filter((_, index) => index % Math.max(1, Math.floor(result.points.length / 30)) === 0).map((point) => <tr key={point.yPosition} className="border-t"><td className="px-2 py-2">{point.yPosition.toFixed(3)}</td><td>{point.distributedLoad.toFixed(1)}</td><td>{point.shearForce.toFixed(1)}</td><td>{point.bendingMoment.toFixed(1)}</td><td>{(point.deflection * 1000).toFixed(2)} mm</td><td>{(point.twist * 180 / Math.PI).toFixed(3)}°</td><td>{(point.axialStress / 1e6).toFixed(1)} MPa</td><td>{(point.shearStress / 1e6).toFixed(1)} MPa</td><td>{formatNumber(point.minReserveFactor, 2)}</td><td>{point.criticalPlyId}</td></tr>)}</tbody></table></div></CardBody></Card>
  </div>;
}

function SparPreview({ design, selectedId, onSelect }: { design: StructuralDesign; selectedId?: string; onSelect: (id: string) => void }) {
  const span = structuralSpan(design) || 1;
  return <svg viewBox="0 0 800 220" className="h-56 w-full" role="img" aria-label="主翼パイプ配置"><path d="M 40 110 L 760 185 L 760 45 Z" fill="#eff6ff" stroke="#93c5fd" />{tubeSectionBounds(design.sections).map(({ section, start, end }) => { const x1 = 40 + start / span * 720; const x2 = 40 + end / span * 720; const width = Math.max(5, section.outerDiameter * 100); return <g key={section.id} role="button" aria-label={`${section.id}を選択`} onClick={() => onSelect(section.id)} className="cursor-pointer"><line x1={x1} y1="112" x2={x2} y2="112" stroke={section.id === selectedId ? "#2563eb" : "#475569"} strokeWidth={width} /><line x1={x1} y1={112 - width / 2} x2={x1} y2={112 + width / 2} stroke="white" /><text x={(x1 + x2) / 2} y="148" textAnchor="middle" fontSize="12" fill="#475569">{section.length.toFixed(2)} m</text></g>; })}</svg>;
}

function ResultChart({ points, label }: { points: readonly { x: number; value: number }[]; label: string }) {
  if (!points.length) return <p className="text-sm text-slate-500">表示できるデータがありません。</p>;
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || 1;
  const polyline = points.map((point) => `${40 + point.x / maxX * 720},${190 - (point.value - min) / range * 150}`).join(" ");
  return <div><svg viewBox="0 0 800 220" className="h-64 w-full" role="img" aria-label={label}><line x1="40" y1="190" x2="760" y2="190" stroke="#cbd5e1" /><line x1="40" y1="40" x2="40" y2="190" stroke="#cbd5e1" /><polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="3" /><text x="45" y="30" fontSize="12" fill="#64748b">max {formatNumber(max, 3)}</text><text x="760" y="208" textAnchor="end" fontSize="12" fill="#64748b">Y {maxX.toFixed(2)} m</text></svg></div>;
}

function EmptyDesign({ onCreate }: { onCreate: () => void }) { return <Card><CardBody className="py-10 text-center"><p className="text-sm text-slate-500">構造設計がありません。</p><Button className="mt-4" onClick={onCreate}>最初の構造設計を作成</Button></CardBody></Card>; }
function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: number) => void }) { return <label className="block text-sm"><span className="mb-1 block text-xs text-slate-500">{label}</span><span className="flex items-center gap-2"><input aria-label={label} type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 min-w-0 flex-1 rounded border px-2" /><span className="text-xs text-slate-500">{unit}</span></span></label>; }
function ReadValue({ label, value }: { label: string; value: string }) { return <div className="rounded border px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
function layupLabel(plies: readonly LaminatePly[]) { return `[${plies.map((ply) => `${ply.angle}°×${ply.count}`).join(" / ")}]`; }
function formatGPa(value: number) { return `${(value / 1e9).toFixed(1)} GPa`; }
function sourceLabel(source: StructuralLoadCase["source"]) { return source === "aerodynamic" ? "空力結果" : source === "elliptical" ? "楕円分布" : "手入力"; }
function statusLabel(status: StructuralLoadCase["status"]) { return status === "completed" ? "完了" : status === "needs-review" ? "要確認" : "未実行"; }
function formatNumber(value: number, digits: number) { return Number.isFinite(value) ? value.toFixed(digits) : "∞"; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function createDefaultMaterial(): CarbonMaterial { return { id: createId("material"), name: "新規カーボン材料", e1: 120e9, e2: 8e9, g12: 4e9, nu12: 0.3, tensileStrength1: 1200e6, compressiveStrength1: 700e6, tensileStrength2: 40e6, compressiveStrength2: 120e6, shearStrength12: 60e6, density: 1550, plyThickness: 0.000125, reductionFactor: 0.8 }; }
function createDefaultDesign(aircraft: AircraftGeometry, material?: CarbonMaterial): StructuralDesign { const id = createId("structure"); const materialId = material?.id ?? ""; const halfSpan = aircraft.span / 2; return { id, name: "新規メインパイプ", sections: [{ id: createId("section"), length: halfSpan / 2, outerDiameter: 0.08, plies: [{ id: createId("ply"), materialId, angle: 0, count: 6 }] }, { id: createId("section"), length: halfSpan / 2, outerDiameter: 0.04, plies: [{ id: createId("ply"), materialId, angle: 0, count: 4 }] }], loadCases: [] }; }
function createTubeSection(material?: CarbonMaterial): StructuralTubeSection { return { id: createId("section"), length: 0.5, outerDiameter: 0.05, plies: [{ id: createId("ply"), materialId: material?.id ?? "", angle: 0, count: 4 }] }; }
function getSectionSummary(section: StructuralTubeSection, materials: readonly CarbonMaterial[]) { try { const laminate = calculateLaminate(section.plies, new Map(materials.map((material) => [material.id, material]))); const innerDiameter = section.outerDiameter - 2 * laminate.thickness; return { thickness: laminate.thickness, innerDiameter, linearMass: laminate.arealMass * Math.PI * (section.outerDiameter - laminate.thickness) }; } catch { return null; } }
function structuralSpan(design: StructuralDesign) { return design.sections.reduce((sum, section) => sum + section.length, 0); }
function tubeSectionBounds(sections: readonly StructuralTubeSection[]) { let start = 0; return sections.map((section) => { const bound = { section, start, end: start + section.length }; start = bound.end; return bound; }); }
function updateLoadPoint(design: StructuralDesign, loadCase: StructuralLoadCase, index: number, patch: Partial<StructuralLoadCase["distributedLoads"][number]>, onSave: (design: StructuralDesign) => void) { onSave({ ...design, loadCases: design.loadCases.map((item) => item.id === loadCase.id ? { ...item, status: "needs-review", distributedLoads: item.distributedLoads.map((load, itemIndex) => itemIndex === index ? { ...load, ...patch } : load).sort((a, b) => a.yPosition - b.yPosition) } : item) }); }
function updatePointLoad(design: StructuralDesign, loadCase: StructuralLoadCase, id: string, patch: Partial<StructuralLoadCase["pointLoads"][number]>, onSave: (design: StructuralDesign) => void) { onSave({ ...design, loadCases: design.loadCases.map((item) => item.id === loadCase.id ? { ...item, status: "needs-review", pointLoads: item.pointLoads.map((load) => load.id === id ? { ...load, ...patch } : load) } : item) }); }
function download(fileName: string, mimeType: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: mimeType })); const link = document.createElement("a"); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url); }
