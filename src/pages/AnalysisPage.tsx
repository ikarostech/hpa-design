import { Copy, Pencil, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AircraftPreview } from "../features/aircraft/components/AircraftPreview";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import { createAnalysisCase, createAnalysisCaseDraft, type AnalysisCaseDraft, updateAnalysisCase, validateAnalysisCaseDraft } from "../features/analysis/model/analysisCaseDraft";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import { AnalysisExecutionCancelledError, executeAnalysisCase } from "../features/analysis/services/analysisExecutionService";
import { formatAnalysisNumber } from "../features/analysis/services/analysisResultExporter";
import { PolarCharts } from "../features/airfoils/components/PolarCharts";
import type { AirfoilPolar } from "../features/airfoils/model/types";
import { useJobs } from "../shared/jobs/JobProvider";
import type { EntityRepository, Job, ResultViewController, SingleSelection } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";
import { MetricCard } from "../shared/ui/MetricCard";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobs = useJobs();
  const controllers = useRef(new Map<string, AbortController>());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<AnalysisCaseDraft>(() => createNewDraft(aircraft.id));
  const [errors, setErrors] = useState<Partial<Record<keyof AnalysisCaseDraft, string>>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [displayedResultIds, setDisplayedResultIds] = useState<string[]>(() => results[0] ? [results[0].id] : []);
  const [primaryResultId, setPrimaryResultId] = useState<string | null>(() => results[0]?.id ?? null);

  useEffect(() => {
    if (!selectedCaseId || !cases.some((item) => item.id === selectedCaseId)) setSelectedCaseId(cases[0]?.id ?? null);
  }, [cases, selectedCaseId]);
  useEffect(() => {
    setDisplayedResultIds((current) => current.filter((id) => results.some((result) => result.id === id)));
    setPrimaryResultId((current) => results.some((result) => result.id === current) ? current : results[0]?.id ?? null);
  }, [results]);

  const caseSelection: SingleSelection<string> = { selectedId: selectedCaseId, select: setSelectedCaseId, clear: () => setSelectedCaseId(null) };
  const selected = cases.find((item) => item.id === caseSelection.selectedId) ?? cases[0];
  const selectedResult = results.find((result) => result.caseId === selected?.id);
  const resultView: ResultViewController<string> = {
    state: { displayedResultIds, primaryResultId, compareMode: displayedResultIds.length > 1 },
    show: (id) => setDisplayedResultIds((current) => current.includes(id) ? current : [...current, id]),
    hide: (id) => setDisplayedResultIds((current) => current.filter((currentId) => currentId !== id)),
    setPrimary: (id) => { setPrimaryResultId(id); setDisplayedResultIds((current) => current.includes(id) ? current : [...current, id]); },
    clear: () => { setDisplayedResultIds([]); setPrimaryResultId(null); },
  };
  const displayedResults = results.filter((result) => resultView.state.displayedResultIds.includes(result.id));
  const primaryResult = results.find((result) => result.id === resultView.state.primaryResultId);
  const resultForView = primaryResult ?? selectedResult;
  const selectedJob = jobs.jobs.find((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, selected?.id));
  const hasRun = Boolean(selectedResult && selectedResult.status === "completed");
  const chartData = useMemo(() => resultForView?.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) ?? [], [resultForView]);
  const chartSeries = useMemo(() => displayedResults.map((result, index) => ({ id: result.id, name: cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId, color: ["#2563eb", "#0f766e", "#dc2626", "#7c3aed"][index % 4], data: result.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) })), [cases, displayedResults]);
  const activeTab = params.get("tab") === "results" ? "結果" : "解析";

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
  const runAnalysis = async () => {
    if (!selected || selectedJob) return;
    const jobId = createId("job-aircraft-analysis");
    const controller = new AbortController();
    controllers.current.set(jobId, controller);
    const startedAt = new Date().toISOString();
    jobs.createJob<AnalysisJob>({
      id: jobId,
      kind: "aircraft-analysis",
      name: `${selected.name} analysis`,
      status: "running",
      createdAt: startedAt,
      startedAt,
      progress: { completed: 0, total: countSweepPoints(selected) },
      settings: { caseId: selected.id },
    });
    try {
      const result = await executeAnalysisCase({
        analysisCase: selected,
        aircraft,
        polars,
        signal: controller.signal,
        createId: () => createId("analysis-result"),
        onProgress: (progress) => jobs.updateJob<AnalysisJob>(jobId, { progress }),
      });
      saveAnalysisResult(result);
      jobs.completeJob<AnalysisJob>(jobId, { result, progress: { completed: result.rows.length, total: result.rows.length } });
      setParams({ tab: "results" });
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
      title="解析ケースと結果"
      description="LLT / VLM の条件を管理し、設計ドキュメントへ結果を保存します。"
      tabs={<div role="tablist" className="flex gap-2 border-b border-slate-200">
        {(["解析", "結果"] as const).map((tab) => (
          <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setParams(tab === "結果" ? { tab: "results" } : {})} className={`px-3 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>{tab}</button>
        ))}
      </div>}
    >

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">解析ケース</h2><Button size="sm" onClick={openCreate}><Plus size={15} />新規</Button></CardHeader>
            <CardBody className="space-y-2">
              {cases.length ? cases.map((item) => (
                <button key={item.id} aria-label={`解析ケース ${item.name}: ${item.method}, ${formatAlphaRange(item.alphaStart, item.alphaEnd, item.alphaStep)}`} onClick={() => caseSelection.select(item.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${item.id === caseSelection.selectedId ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                  <span>{item.name}</span><span className="mt-1 block text-xs text-slate-500">{item.method} / {formatAlphaRange(item.alphaStart, item.alphaEnd, item.alphaStep)}</span>
                </button>
              )) : <p className="text-sm text-slate-500">解析ケースはまだありません。</p>}
            </CardBody>
          </Card>

          {selected ? <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">ケース操作</h2></CardHeader>
            <CardBody className="grid gap-2">
              <Button variant="secondary" onClick={() => openEdit(selected)}><Pencil size={16} />編集</Button>
              <Button variant="secondary" onClick={() => void duplicateCase(selected)}><Copy size={16} />複製</Button>
              <Button variant="destructive" onClick={() => setPendingDeleteId(selected.id)}><Trash2 size={16} />削除</Button>
            </CardBody>
          </Card> : null}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard label="CLmax" value={resultForView ? formatAnalysisNumber(resultForView.clMax, 3) : "-"} />
            <MetricCard label="CDmin" value={resultForView ? formatAnalysisNumber(resultForView.cdMin, 6) : "-"} />
            <MetricCard label="最大 L/D" value={resultForView ? formatAnalysisNumber(resultForView.maxLD, 2) : "-"} />
            <MetricCard label="Cm0" value={resultForView ? formatAnalysisNumber(resultForView.cm0, 4) : "-"} />
            <MetricCard label="実行状態" value={selectedJob ? "実行中" : analysisStatusLabel(selected?.status ?? "not-run")} />
          </div>
          <Card><CardHeader><h2 className="font-semibold text-slate-950">結果グラフ</h2></CardHeader><CardBody><PolarCharts data={chartData} series={chartSeries} mode="analysis" /></CardBody></Card>
          <Card><CardHeader><h2 className="font-semibold text-slate-950">結果一覧</h2></CardHeader><CardBody><ResultTable result={resultForView} /></CardBody></Card>
          {activeTab === "結果" ? <AnalysisResultComparison results={results} cases={cases} resultView={resultView} /> : null}
        </div>

        <div className="space-y-5">
          <Card><CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">翼プレビュー</h2><Badge tone={hasRun ? "green" : "slate"}>{hasRun ? "結果あり" : analysisStatusLabel(selected?.status ?? "not-run")}</Badge></CardHeader><CardBody><AircraftPreview lift={hasRun} geometry={aircraft} /></CardBody></Card>
          <Card><CardHeader><h2 className="font-semibold text-slate-950">解析設定</h2></CardHeader><CardBody className="space-y-3">
            <Setting label="解析手法" value={selected?.method ?? "-"} /><Setting label="α sweep" value={selected ? formatAlphaRange(selected.alphaStart, selected.alphaEnd, selected.alphaStep) : "-"} />
            <Setting label="速度" value={selected ? `${selected.speed} m/s` : "-"} /><Setting label="高度" value={selected ? `${selected.altitude} m` : "-"} />
            <Setting label="Re" value={selected?.reynolds.toLocaleString() ?? "-"} /><Setting label="使用ジオメトリ" value={selected?.geometryId ?? "-"} />
            {selectedJob ? <><p className="text-sm text-blue-700">{selectedJob.progress?.message ?? "解析を開始しています…"} ({selectedJob.progress?.completed ?? 0}/{selectedJob.progress?.total ?? 0})</p><Button className="w-full" variant="destructive" onClick={() => controllers.current.get(selectedJob.id)?.abort()}><X size={16} />キャンセル</Button></> : <Button className="w-full" disabled={!selected} onClick={() => void runAnalysis()}><Play size={16} />{hasRun ? "再実行" : "解析を実行"}</Button>}
          </CardBody></Card>
          <Button className="w-full" variant="secondary" onClick={() => navigate("/aircraft")}><RotateCcw size={16} />設計へ戻る</Button>
        </div>
      </div>

      {editorMode ? <CaseEditor draft={draft} errors={errors} title={editorMode === "create" ? "解析ケースを新規作成" : "解析ケースを編集"} onChange={setDraft} onSave={() => void saveCase()} onClose={() => setEditorMode(null)} /> : null}
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
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><Card className="w-full max-w-2xl"><CardHeader className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">{title}</h2><button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></CardHeader><CardBody className="grid gap-4 md:grid-cols-2">
    <label className="grid gap-1 text-sm text-slate-700 md:col-span-2"><span>ケース名</span><input className="rounded-md border border-slate-300 px-3 py-2" value={draft.name} onChange={(event) => update("name", event.target.value)} />{errors.name ? <span className="text-xs text-red-600">{errors.name}</span> : null}</label>
    <label className="grid gap-1 text-sm text-slate-700"><span>解析手法</span><select className="rounded-md border border-slate-300 px-3 py-2" value={draft.method} onChange={(event) => update("method", event.target.value as AnalysisCase["method"])}><option value="LLT">LLT</option><option value="VLM">VLM</option></select></label>
    <label className="grid gap-1 text-sm text-slate-700"><span>使用ジオメトリ</span><input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2" value={draft.geometryId} readOnly />{errors.geometryId ? <span className="text-xs text-red-600">{errors.geometryId}</span> : null}</label>
    {numberInput("alphaStart", "α 開始 (°)")}{numberInput("alphaEnd", "α 終了 (°)")}{numberInput("alphaStep", "α 刻み (°)")}{numberInput("speed", "速度 (m/s)")}{numberInput("altitude", "高度 (m)")}{numberInput("reynolds", "Reynolds 数")}
    <div className="flex justify-end gap-2 md:col-span-2"><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button onClick={onSave}>保存</Button></div>
  </CardBody></Card></div>;
}

function AnalysisResultComparison({ results, cases, resultView }: { results: readonly AnalysisResult[]; cases: readonly AnalysisCase[]; resultView: ResultViewController<string> }) {
  const displayed = new Set(resultView.state.displayedResultIds);
  return <Card><CardHeader><h2 className="font-semibold text-slate-950">比較する結果</h2><p className="mt-1 text-sm text-slate-500">表示を複数選ぶとグラフを比較できます。主結果は指標と表に表示します。</p></CardHeader><CardBody className="space-y-2">{results.length ? results.map((result) => <div key={result.id} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={displayed.has(result.id)} aria-label={`${result.id}を比較に表示`} onChange={() => displayed.has(result.id) ? resultView.hide(result.id) : resultView.show(result.id)} /><input type="radio" checked={resultView.state.primaryResultId === result.id} aria-label={`${result.id}を主結果にする`} onChange={() => resultView.setPrimary(result.id)} /><span>{cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId}</span><span>CLmax {formatAnalysisNumber(result.clMax, 3)} / L/D {formatAnalysisNumber(result.maxLD, 2)}</span></div>) : <p className="text-sm text-slate-500">比較できる解析結果はまだありません。</p>}</CardBody></Card>;
}

function ResultTable({ result }: { result: AnalysisResult | undefined }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{["α", "CL", "CD", "Cm", "L/D", "状態"].map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(result?.rows ?? []).map((row) => <tr key={`${row.caseId}-${row.alpha}`}><td className="px-2 py-3">{formatAnalysisNumber(row.alpha, 1)}°</td><td className="px-2 py-3">{formatAnalysisNumber(row.cl, 4)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.cd, 6)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.cm, 4)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.ld, 2)}</td><td className="px-2 py-3"><Badge tone={row.status === "completed" ? "green" : "amber"}>{analysisStatusLabel(row.status)}</Badge></td></tr>)}</tbody></table>{!result ? <p className="px-2 py-5 text-sm text-slate-500">実行結果はまだありません。</p> : null}</div>;
}

function Setting({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>; }
function createNewDraft(geometryId: string): AnalysisCaseDraft { return { name: "", method: "LLT", alphaStart: -4, alphaEnd: 12, alphaStep: 2, speed: 20, altitude: 0, reynolds: 300000, geometryId }; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function countSweepPoints(analysisCase: AnalysisCase) { return Math.floor((analysisCase.alphaEnd - analysisCase.alphaStart) / analysisCase.alphaStep) + 1; }
function formatAlphaRange(start: number, end: number, step: number) { return `${start}° to ${end}° (${step}°刻み)`; }
function analysisStatusLabel(status: "completed" | "not-run" | "needs-review") { return status === "completed" ? "完了" : status === "not-run" ? "未実行" : "要確認"; }
function hasCaseId(job: Job<string, unknown, unknown>, caseId: string | undefined) { return Boolean(caseId && typeof job.settings === "object" && job.settings !== null && "caseId" in job.settings && job.settings.caseId === caseId); }
