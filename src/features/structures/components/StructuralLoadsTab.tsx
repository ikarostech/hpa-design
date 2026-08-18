import { Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { AnalysisResult } from "../../analysis/model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { DeleteConfirmationDialog } from "../../../shared/ui/table/DeleteConfirmationDialog";
import { RowActions } from "../../../shared/ui/table/RowActions";
import { createStructuralId, structuralSpan } from "../model/structuralWorkspace";
import type { StructuralDesign, StructuralLoadCase } from "../model/types";
import { createLoadCaseFromAerodynamicResult } from "../services/structuralLoadService";
import { StructuralResultChart } from "./StructuralResultChart";

type DeleteTarget =
  | { kind: "load-case"; id: string; label: string }
  | { kind: "distributed-load"; index: number; label: string }
  | { kind: "point-load"; id: string; label: string };

export function StructuralLoadsTab({ design, aircraft, aerodynamicResults, onSaveDesign, onRun }: {
  design: StructuralDesign;
  aircraft: AircraftGeometry;
  aerodynamicResults: readonly AnalysisResult[];
  onSaveDesign: (design: StructuralDesign) => void;
  onRun: (loadCase: StructuralLoadCase) => void;
}) {
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(design.loadCases[0]?.id ?? null);
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [selectedAerodynamicResultId, setSelectedAerodynamicResultId] = useState<string | null>(aerodynamicResults[0]?.id ?? null);
  const selectedAerodynamicResult = aerodynamicResults.find((result) => result.id === selectedAerodynamicResultId) ?? aerodynamicResults[0];
  const aerodynamicRows = selectedAerodynamicResult?.rows.filter((row) => row.spanwise) ?? [];
  const [selectedAerodynamicAlpha, setSelectedAerodynamicAlpha] = useState<number | null>(() => preferredAerodynamicAlpha(aerodynamicResults[0]));
  const selectedLoad = design.loadCases.find((loadCase) => loadCase.id === selectedLoadId) ?? design.loadCases[0];

  useEffect(() => {
    if (!aerodynamicResults.some((result) => result.id === selectedAerodynamicResultId)) setSelectedAerodynamicResultId(aerodynamicResults[0]?.id ?? null);
  }, [aerodynamicResults, selectedAerodynamicResultId]);
  useEffect(() => {
    if (!aerodynamicRows.some((row) => row.alpha === selectedAerodynamicAlpha)) setSelectedAerodynamicAlpha(preferredAerodynamicAlpha(selectedAerodynamicResult));
  }, [aerodynamicRows, selectedAerodynamicAlpha, selectedAerodynamicResult]);

  const update = (id: string, patch: Partial<StructuralLoadCase>) => onSaveDesign({
    ...design,
    loadCases: design.loadCases.map((item) => item.id === id ? { ...item, ...patch, status: "needs-review" } : item),
  });

  const addManual = () => onSaveDesign({
    ...design,
    loadCases: [...design.loadCases, {
      id: createStructuralId("load"),
      name: "手入力荷重",
      source: "manual",
      loadFactor: 1,
      safetyFactor: 1.5,
      distributedLoads: [
        { yPosition: 0, liftPerLength: 100, torquePerLength: 0 },
        { yPosition: structuralSpan(design) || aircraft.span / 2, liftPerLength: 0, torquePerLength: 0 },
      ],
      pointLoads: [],
      status: "not-run",
    }],
  });

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "load-case") {
      onSaveDesign({ ...design, loadCases: design.loadCases.filter((item) => item.id !== pendingDelete.id) });
    } else if (pendingDelete.kind === "distributed-load") {
      if (selectedLoad) update(selectedLoad.id, { distributedLoads: selectedLoad.distributedLoads.filter((_, index) => index !== pendingDelete.index) });
    } else if (selectedLoad) {
      update(selectedLoad.id, { pointLoads: selectedLoad.pointLoads.filter((item) => item.id !== pendingDelete.id) });
    }
    setPendingDelete(null);
  };

  return <div className="space-y-5">
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold">構造荷重ケース</h2><p className="mt-1 text-sm text-slate-500">荷重倍数と安全係数は解析荷重へ乗算されます。</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={addManual}><Plus size={15} />手入力</Button>
          {selectedAerodynamicResult ? <>
            <select aria-label="空力解析結果" value={selectedAerodynamicResult.id} onChange={(event) => { setSelectedAerodynamicResultId(event.target.value); setSelectedAerodynamicAlpha(preferredAerodynamicAlpha(aerodynamicResults.find((result) => result.id === event.target.value))); }} className="h-8 rounded border bg-white px-2 text-xs">
              {aerodynamicResults.map((result) => <option key={result.id} value={result.id}>{result.caseSnapshot?.name ?? result.caseId}</option>)}
            </select>
            {aerodynamicRows.length ? <select aria-label="空力運用点" value={selectedAerodynamicAlpha ?? ""} onChange={(event) => setSelectedAerodynamicAlpha(Number(event.target.value))} className="h-8 rounded border bg-white px-2 text-xs">
              {aerodynamicRows.map((row) => <option key={row.alpha} value={row.alpha}>α {row.alpha.toFixed(1)}° / CL {row.cl.toFixed(3)}</option>)}
            </select> : null}
            <Button size="sm" onClick={() => onSaveDesign({ ...design, loadCases: [...design.loadCases, createLoadCaseFromAerodynamicResult({ result: selectedAerodynamicResult, aircraft, alphaDegrees: selectedAerodynamicAlpha ?? undefined })] })}><Plus size={15} />空力結果から作成</Button>
          </> : null}
        </div>
      </CardHeader>
      <CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">ケース</th><th>荷重源</th><th>荷重倍数</th><th>安全係数</th><th>最大分布荷重</th><th>状態</th><th className="text-right">操作</th></tr></thead>
        <tbody>{design.loadCases.map((loadCase) => <tr key={loadCase.id} className={`border-t ${loadCase.id === selectedLoad?.id ? "bg-blue-50" : ""}`} onClick={() => setSelectedLoadId(loadCase.id)}>
          <td className="px-2 py-3 font-medium">{loadCase.name}</td><td>{sourceLabel(loadCase.source)}</td>
          <td><input aria-label={`${loadCase.name}の荷重倍数`} className="h-8 w-20 rounded border px-2" type="number" step="0.1" value={loadCase.loadFactor} onChange={(event) => update(loadCase.id, { loadFactor: Number(event.target.value) })} /></td>
          <td><input aria-label={`${loadCase.name}の安全係数`} className="h-8 w-20 rounded border px-2" type="number" step="0.1" value={loadCase.safetyFactor} onChange={(event) => update(loadCase.id, { safetyFactor: Number(event.target.value) })} /></td>
          <td>{Math.max(0, ...loadCase.distributedLoads.map((load) => load.liftPerLength)).toFixed(1)} N/m</td>
          <td><Badge tone={loadCase.status === "completed" ? "green" : loadCase.status === "needs-review" ? "amber" : "slate"}>{statusLabel(loadCase.status)}</Badge></td>
          <td className="text-right"><div className="flex justify-end gap-1"><Button size="sm" aria-label={`${loadCase.name}を解析`} onClick={() => onRun(loadCase)}><Play size={15} />解析</Button><RowActions entityLabel={loadCase.name} delete={{ onAction: () => setPendingDelete({ kind: "load-case", id: loadCase.id, label: loadCase.name }) }} /></div></td>
        </tr>)}</tbody>
      </table>{!design.loadCases.length ? <p className="py-5 text-sm text-slate-500">荷重ケースを作成してください。</p> : null}</div></CardBody>
    </Card>

    {selectedLoad ? <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="font-semibold">荷重点 — {selectedLoad.name}</h2>
        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => update(selectedLoad.id, { pointLoads: [...selectedLoad.pointLoads, { id: createStructuralId("point-load"), yPosition: structuralSpan(design) || aircraft.span / 2, force: 0, torque: 0 }] })}><Plus size={15} />集中荷重</Button><Button size="sm" onClick={() => update(selectedLoad.id, { distributedLoads: [...selectedLoad.distributedLoads, { yPosition: structuralSpan(design) || aircraft.span / 2, liftPerLength: 0, torquePerLength: 0 }] })}><Plus size={15} />分布荷重点</Button></div>
      </CardHeader>
      <CardBody className="space-y-4">
        <StructuralResultChart points={selectedLoad.distributedLoads.map((load) => ({ x: load.yPosition, value: load.liftPerLength }))} label="分布荷重 N/m" />
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置 m</th><th>揚力 N/m</th><th>トルク Nm/m</th><th className="text-right">操作</th></tr></thead><tbody>
          {selectedLoad.distributedLoads.map((load, index) => <tr key={`${load.yPosition}-${index}`} className="border-t"><td className="px-2 py-2"><input aria-label={`荷重点${index + 1}の位置`} type="number" value={load.yPosition} onChange={(event) => updateDistributedLoadPoint(design, selectedLoad, index, { yPosition: Number(event.target.value) }, onSaveDesign)} className="h-8 w-24 rounded border px-2" /></td><td><input aria-label={`荷重点${index + 1}の揚力`} type="number" value={load.liftPerLength} onChange={(event) => updateDistributedLoadPoint(design, selectedLoad, index, { liftPerLength: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td><input aria-label={`荷重点${index + 1}のトルク`} type="number" value={load.torquePerLength} onChange={(event) => updateDistributedLoadPoint(design, selectedLoad, index, { torquePerLength: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td className="text-right"><RowActions entityLabel={`荷重点${index + 1}`} delete={{ disabled: selectedLoad.distributedLoads.length <= 2, disabledReason: selectedLoad.distributedLoads.length <= 2 ? "最低2点の分布荷重が必要です" : undefined, onAction: () => setPendingDelete({ kind: "distributed-load", index, label: `荷重点${index + 1}` }) }} /></td></tr>)}
        </tbody></table></div>
        {selectedLoad.pointLoads.length ? <div className="overflow-x-auto"><h3 className="mb-2 text-sm font-semibold">集中荷重</h3><table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-2 py-2">Y位置 m</th><th>荷重 N</th><th>トルク Nm</th><th className="text-right">操作</th></tr></thead><tbody>
          {selectedLoad.pointLoads.map((load, index) => <tr key={load.id} className="border-t"><td className="px-2 py-2"><input aria-label={`集中荷重${index + 1}の位置`} type="number" value={load.yPosition} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { yPosition: Number(event.target.value) }, onSaveDesign)} className="h-8 w-24 rounded border px-2" /></td><td><input aria-label={`集中荷重${index + 1}の荷重`} type="number" value={load.force} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { force: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td><input aria-label={`集中荷重${index + 1}のトルク`} type="number" value={load.torque} onChange={(event) => updatePointLoad(design, selectedLoad, load.id, { torque: Number(event.target.value) }, onSaveDesign)} className="h-8 w-28 rounded border px-2" /></td><td className="text-right"><RowActions entityLabel={`集中荷重${index + 1}`} delete={{ onAction: () => setPendingDelete({ kind: "point-load", id: load.id, label: `集中荷重${index + 1}` }) }} /></td></tr>)}
        </tbody></table></div> : null}
      </CardBody>
    </Card> : null}

    <DeleteConfirmationDialog open={Boolean(pendingDelete)} title={deleteTitle(pendingDelete)} description={pendingDelete ? `「${pendingDelete.label}」を削除します。` : ""} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
  </div>;
}

function updateDistributedLoadPoint(design: StructuralDesign, loadCase: StructuralLoadCase, index: number, patch: Partial<StructuralLoadCase["distributedLoads"][number]>, onSave: (design: StructuralDesign) => void) {
  onSave({ ...design, loadCases: design.loadCases.map((item) => item.id === loadCase.id ? { ...item, status: "needs-review", distributedLoads: item.distributedLoads.map((load, itemIndex) => itemIndex === index ? { ...load, ...patch } : load).sort((left, right) => left.yPosition - right.yPosition) } : item) });
}

function updatePointLoad(design: StructuralDesign, loadCase: StructuralLoadCase, id: string, patch: Partial<StructuralLoadCase["pointLoads"][number]>, onSave: (design: StructuralDesign) => void) {
  onSave({ ...design, loadCases: design.loadCases.map((item) => item.id === loadCase.id ? { ...item, status: "needs-review", pointLoads: item.pointLoads.map((load) => load.id === id ? { ...load, ...patch } : load) } : item) });
}

function deleteTitle(target: DeleteTarget | null) {
  if (!target) return "削除";
  return target.kind === "load-case" ? "荷重ケースを削除" : target.kind === "distributed-load" ? "分布荷重点を削除" : "集中荷重を削除";
}

function sourceLabel(source: StructuralLoadCase["source"]) {
  return source === "aerodynamic" ? "空力結果" : source === "elliptical" ? "楕円分布" : "手入力";
}

function statusLabel(status: StructuralLoadCase["status"]) {
  return status === "completed" ? "完了" : status === "needs-review" ? "要確認" : "未実行";
}

function preferredAerodynamicAlpha(result: AnalysisResult | undefined) {
  return [...(result?.rows ?? [])].filter((row) => row.spanwise).sort((left, right) => right.cl - left.cl)[0]?.alpha ?? null;
}
