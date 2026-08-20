import { Copy, Play, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import { createAnalysisCase, createAnalysisCaseDraft, type AnalysisCaseDraft, updateAnalysisCase, validateAnalysisCaseDraft } from "../features/analysis/model/analysisCaseDraft";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import { AnalysisExecutionCancelledError, executeAnalysisCase } from "../features/analysis/services/analysisExecutionService";
import { PolarCharts } from "../features/airfoils/components/PolarCharts";
import type { AirfoilPolar } from "../features/airfoils/model/types";
import { useJobs } from "../shared/jobs/JobProvider";
import type { EntityRepository, Job, ResultViewController, SingleSelection } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";
import { InspectorDrawer } from "../shared/ui/inspector/InspectorDrawer";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { RowActions } from "../shared/ui/table/RowActions";
import { TableActionCell, TableActionHeader } from "../shared/ui/table/TableActionColumn";

interface AnalysisPageProps {
  aircraft: AircraftGeometry;
  cases: readonly AnalysisCase[];
  results: readonly AnalysisResult[];
  polars: readonly AirfoilPolar[];
  analysisCaseRepository: EntityRepository<AnalysisCase, string>;
  saveAnalysisResult: (result: AnalysisResult) => void;
}

type AnalysisJob = Job<string, AnalysisResult, { caseId: string }>;
type EditorMode = "create" | "edit" | null;

export function AnalysisPage({ aircraft, cases, results, polars, analysisCaseRepository, saveAnalysisResult }: AnalysisPageProps) {
  const jobs = useJobs();
  const controllers = useRef(new Map<string, AbortController>());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [detailCaseId, setDetailCaseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnalysisCaseDraft>(() => createNewDraft(aircraft.id));
  const [errors, setErrors] = useState<Partial<Record<keyof AnalysisCaseDraft, string>>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [displayedResultIds, setDisplayedResultIds] = useState<string[]>(() => results[0] ? [results[0].id] : []);

  useEffect(() => {
    if (!selectedCaseId || !cases.some((item) => item.id === selectedCaseId)) setSelectedCaseId(cases[0]?.id ?? null);
  }, [cases, selectedCaseId]);
  useEffect(() => {
    setDisplayedResultIds((current) => current.filter((id) => results.some((result) => result.id === id)));
  }, [results]);

  const caseSelection: SingleSelection<string> = { selectedId: selectedCaseId, select: setSelectedCaseId, clear: () => setSelectedCaseId(null) };
  const selected = cases.find((item) => item.id === caseSelection.selectedId) ?? cases[0];
  const selectedResult = results.find((result) => result.caseId === selected?.id);
  const resultView: ResultViewController<string> = {
    state: { displayedResultIds, primaryResultId: selectedResult?.id ?? null, compareMode: displayedResultIds.length > 1 },
    show: (id) => setDisplayedResultIds((current) => current.includes(id) ? current : [...current, id]),
    hide: (id) => setDisplayedResultIds((current) => current.filter((currentId) => currentId !== id)),
    setPrimary: (id) => {
      const result = results.find((item) => item.id === id);
      if (result) setSelectedCaseId(result.caseId);
    },
    clear: () => setDisplayedResultIds([]),
  };
  const displayedResults = results.filter((result) => resultView.state.displayedResultIds.includes(result.id));
  const resultForView = selectedResult ?? displayedResults[0] ?? results[0];
  const selectedJob = jobs.jobs.find((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, selected?.id));
  const hasRun = Boolean(selectedResult && selectedResult.status === "completed");
  const chartData = useMemo(() => resultForView?.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) ?? [], [resultForView]);
  const chartSeries = useMemo(() => displayedResults.map((result, index) => ({ id: result.id, name: cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId, color: ["#2563eb", "#0f766e", "#dc2626", "#7c3aed"][index % 4], data: result.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) })), [cases, displayedResults]);

  const openCreate = () => {
    setDraft(createNewDraft(aircraft.id));
    setErrors({});
    setEditorMode("create");
  };
  const openEdit = (analysisCase: AnalysisCase) => {
    setDraft(createAnalysisCaseDraft(analysisCase));
    setErrors({});
    setEditorMode("edit");
  };
  const saveCase = async () => {
    const validation = validateAnalysisCaseDraft(draft, new Set([aircraft.id]));
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    const next = editorMode === "edit" && selected
      ? updateAnalysisCase(selected, draft)
      : createAnalysisCase(createId("case"), draft);
    await analysisCaseRepository.save(next);
    setSelectedCaseId(next.id);
    setEditorMode(null);
  };
  const duplicateCase = async (analysisCase: AnalysisCase) => {
    const duplicate = createAnalysisCase(createId("case"), { ...createAnalysisCaseDraft(analysisCase), name: `${analysisCase.name} copy` });
    await analysisCaseRepository.save(duplicate);
    setSelectedCaseId(duplicate.id);
  };
  const deleteCase = async (analysisCaseId: string) => {
    await analysisCaseRepository.remove(analysisCaseId);
    setPendingDeleteId(null);
  };
  const runAnalysis = async (analysisCase = selected) => {
    const runningJob = jobs.jobs.find((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, analysisCase?.id));
    if (!analysisCase || runningJob) return;
    const jobId = createId("job-aircraft-analysis");
    const controller = new AbortController();
    controllers.current.set(jobId, controller);
    const startedAt = new Date().toISOString();
    jobs.createJob<AnalysisJob>({
      id: jobId,
      kind: "aircraft-analysis",
      name: `${analysisCase.name} analysis`,
      status: "running",
      createdAt: startedAt,
      startedAt,
      progress: { completed: 0, total: countSweepPoints(analysisCase) },
      settings: { caseId: analysisCase.id },
    });
    try {
      const result = await executeAnalysisCase({
        analysisCase,
        aircraft,
        polars,
        signal: controller.signal,
        createId: () => createId("analysis-result"),
        onProgress: (progress) => jobs.updateJob<AnalysisJob>(jobId, { progress }),
      });
      saveAnalysisResult(result);
      jobs.completeJob<AnalysisJob>(jobId, { result, progress: { completed: result.rows.length, total: result.rows.length } });
    } catch (error) {
      if (error instanceof AnalysisExecutionCancelledError) {
        jobs.cancelJob(jobId);
      } else {
        jobs.failJob(jobId, error instanceof Error ? error.message : "解析の実行に失敗しました。");
      }
    } finally {
      controllers.current.delete(jobId);
    }
  };

  return (
    <PageTemplate
      title="空力解析"
      description="LLT / VLM の解析ケースを管理し、翼の空力特性を比較します。"
    >

      <div className="space-y-5">
        <Card><CardHeader className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">選択ケースの解析結果</h2><p className="mt-1 text-sm text-slate-500">解析ケース表の「表示」で選んだ結果を同じグラフ上で比較します。</p></div><Badge tone={displayedResults.length ? "green" : "slate"}>{displayedResults.length}件表示</Badge></CardHeader><CardBody>{displayedResults.length ? <PolarCharts data={chartData} series={chartSeries} mode="analysis" /> : <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">解析済みケースの「表示」を選ぶと、結果グラフがここに表示されます。</p>}</CardBody></Card>
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-slate-950">解析ケース</h2><p className="mt-1 text-sm text-slate-500">条件の確認、編集、再実行、複製、削除を行います。</p></div>
            <Button variant="secondary" size="sm" onClick={openCreate}><Plus size={15} />解析ケースを作成</Button>
          </CardHeader>
          <CardBody>
            {cases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>{["表示", "ケース名", "手法", "α sweep", "速度", "高度", "状態"].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}<TableActionHeader /></tr></thead>
              <tbody className="divide-y divide-slate-100">{cases.map((item) => {
                const result = results.find((candidate) => candidate.caseId === item.id);
                const running = jobs.jobs.some((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, item.id));
                return <tr key={item.id} className={item.id === caseSelection.selectedId ? "bg-blue-50/60" : "hover:bg-slate-50"} onClick={() => caseSelection.select(item.id)}>
                  <td className="px-2 py-3"><input type="checkbox" checked={Boolean(result && resultView.state.displayedResultIds.includes(result.id))} disabled={!result} title={result ? "グラフ表示を切り替え" : "解析結果がありません"} aria-label={`${item.name}をグラフに表示`} onClick={(event) => event.stopPropagation()} onChange={() => { if (result) resultView.state.displayedResultIds.includes(result.id) ? resultView.hide(result.id) : resultView.show(result.id); }} /></td>
                  <td className="px-2 py-3 font-medium text-slate-900">{item.name}</td><td className="px-2 py-3">{item.method}</td><td className="px-2 py-3">{formatAlphaRange(item.alphaStart, item.alphaEnd, item.alphaStep)}</td><td className="px-2 py-3">{item.speed} m/s</td><td className="px-2 py-3">{item.altitude} m</td><td className="px-2 py-3"><Badge tone={running ? "blue" : result?.status === "completed" ? "green" : "slate"}>{running ? "実行中" : analysisStatusLabel(result?.status ?? item.status)}</Badge></td>
                  <TableActionCell><RowActions entityLabel={item.name} detail={{ onAction: () => { caseSelection.select(item.id); setDetailCaseId(item.id); } }} edit={{ onAction: () => { caseSelection.select(item.id); openEdit(item); } }} rerun={{ disabled: running, disabledReason: running ? "解析を実行中です" : undefined, onAction: () => void runAnalysis(item) }} custom={[{ key: "duplicate", label: "複製", icon: <Copy size={15} />, onAction: () => void duplicateCase(item) }]} delete={{ onAction: () => setPendingDeleteId(item.id) }} /></TableActionCell>
                </tr>;
              })}</tbody>
            </table></div> : <div className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center"><p className="text-sm text-slate-500">解析ケースはまだありません。</p><Button className="mt-4" onClick={openCreate}><Plus size={15} />最初の解析ケースを作成</Button></div>}
          </CardBody>
        </Card>
      </div>

      {editorMode ? <CaseEditor draft={draft} errors={errors} title={editorMode === "create" ? "解析ケースを新規作成" : "解析ケースを編集"} onChange={setDraft} onSave={() => void saveCase()} onClose={() => setEditorMode(null)} /> : null}
      <InspectorDrawer open={Boolean(detailCaseId && selected)} title="解析ケース詳細" subtitle={selected?.name} closeLabel="解析ケース詳細を閉じる" width="wide" onClose={() => setDetailCaseId(null)} footer={selected ? <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => openEdit(selected)}>編集</Button>{selectedJob ? <Button variant="destructive" onClick={() => controllers.current.get(selectedJob.id)?.abort()}><X size={16} />解析をキャンセル</Button> : <Button aria-label={`${selected.name}を解析`} onClick={() => void runAnalysis(selected)}><Play size={16} />{hasRun ? "再解析" : "解析を実行"}</Button>}</div> : null}>
        {selected ? <div className="space-y-5"><Card><CardHeader className="flex items-center justify-between"><h3 className="font-semibold text-slate-950">解析設定</h3><Badge tone={hasRun ? "green" : "slate"}>{selectedJob ? "実行中" : hasRun ? "結果あり" : analysisStatusLabel(selected.status)}</Badge></CardHeader><CardBody className="grid gap-3 sm:grid-cols-2"><Setting label="解析手法" value={selected.method} /><Setting label="α sweep" value={formatAlphaRange(selected.alphaStart, selected.alphaEnd, selected.alphaStep)} /><Setting label="速度" value={`${selected.speed} m/s`} /><Setting label="高度" value={`${selected.altitude} m`} /><Setting label="Re" value={selected.reynolds.toLocaleString()} /><Setting label="使用ジオメトリ" value={selected.geometryId} /></CardBody></Card>{selectedJob ? <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{selectedJob.progress?.message ?? "解析を開始しています…"} ({selectedJob.progress?.completed ?? 0}/{selectedJob.progress?.total ?? 0})</p> : null}</div> : null}
      </InspectorDrawer>
      <DeleteConfirmationDialog
        open={pendingDeleteId !== null}
        title="解析ケースを削除しますか？"
        description={results.some((result) => result.caseId === pendingDeleteId) ? "このケースの保存済み結果も削除されます。" : "この操作は元に戻せません。"}
        onConfirm={() => { if (pendingDeleteId) void deleteCase(pendingDeleteId); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </PageTemplate>
  );
}

function CaseEditor({ draft, errors, title, onChange, onSave, onClose }: { draft: AnalysisCaseDraft; errors: Partial<Record<keyof AnalysisCaseDraft, string>>; title: string; onChange: (draft: AnalysisCaseDraft) => void; onSave: () => void; onClose: () => void }) {
  const update = <K extends keyof AnalysisCaseDraft>(field: K, value: AnalysisCaseDraft[K]) => onChange({ ...draft, [field]: value });
  const numberInput = (field: "alphaStart" | "alphaEnd" | "alphaStep" | "speed" | "altitude" | "reynolds", label: string) => <label className="grid gap-1 text-sm text-slate-700"><span>{label}</span><input className="rounded-md border border-slate-300 px-3 py-2" type="number" value={draft[field]} onChange={(event) => update(field, Number(event.target.value))} />{errors[field] ? <span className="text-xs text-red-600">{errors[field]}</span> : null}</label>;
  return <InspectorDrawer open title={title} subtitle="LLT / VLM 解析条件" closeLabel="解析ケース編集を閉じる" width="wide" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button aria-label="解析ケースを保存" onClick={onSave}>保存</Button></div>}><div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1 text-sm text-slate-700 md:col-span-2"><span>ケース名</span><input className="rounded-md border border-slate-300 px-3 py-2" value={draft.name} onChange={(event) => update("name", event.target.value)} />{errors.name ? <span className="text-xs text-red-600">{errors.name}</span> : null}</label>
    <label className="grid gap-1 text-sm text-slate-700"><span>解析手法</span><select className="rounded-md border border-slate-300 px-3 py-2" value={draft.method} onChange={(event) => update("method", event.target.value as AnalysisCase["method"])}><option value="LLT">LLT</option><option value="VLM">VLM</option></select></label>
    <label className="grid gap-1 text-sm text-slate-700"><span>使用ジオメトリ</span><input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2" value={draft.geometryId} readOnly />{errors.geometryId ? <span className="text-xs text-red-600">{errors.geometryId}</span> : null}</label>
    {numberInput("alphaStart", "α 開始 (°)")}{numberInput("alphaEnd", "α 終了 (°)")}{numberInput("alphaStep", "α 刻み (°)")}{numberInput("speed", "速度 (m/s)")}{numberInput("altitude", "高度 (m)")}{numberInput("reynolds", "Reynolds 数")}
  </div></InspectorDrawer>;
}

function Setting({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>; }
function createNewDraft(geometryId: string): AnalysisCaseDraft { return { name: "", method: "LLT", alphaStart: -4, alphaEnd: 12, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId }; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function countSweepPoints(analysisCase: AnalysisCase) { return Math.floor((analysisCase.alphaEnd - analysisCase.alphaStart) / analysisCase.alphaStep) + 1; }
function formatAlphaRange(start: number, end: number, step: number) { return `${start}° to ${end}° (${step}°刻み)`; }
function analysisStatusLabel(status: "completed" | "not-run" | "needs-review") { return status === "completed" ? "完了" : status === "not-run" ? "未実行" : "要確認"; }
function hasCaseId(job: Job<string, unknown, unknown>, caseId: string | undefined) { return Boolean(caseId && typeof job.settings === "object" && job.settings !== null && "caseId" in job.settings && job.settings.caseId === caseId); }
