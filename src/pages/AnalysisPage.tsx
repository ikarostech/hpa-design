import { Copy, Play, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import { createAnalysisCase, createAnalysisCaseDraft, type AnalysisCaseDraft, updateAnalysisCase, validateAnalysisCaseDraft } from "../features/analysis/model/analysisCaseDraft";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import { summarizeAircraftStability } from "../features/analysis/model/aircraftStability";
import { stabilityShapeErrors, stabilityShapeLabel, type StabilityFsiShapeOption } from "../features/analysis/model/stabilityShape";
import { StabilityComparison } from "../features/analysis/components/StabilityComparison";
import { StabilityShapeEditor } from "../features/analysis/components/StabilityShapeEditor";
import { AnalysisExecutionCancelledError } from "../features/analysis/services/analysisExecutionService";
import { webAircraftAnalysisRunner, type AircraftAnalysisRunner } from "../features/analysis/services/webAircraftAnalysisRunner";
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
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

export interface AnalysisPageProps {
  fixedFsiShape?: StabilityFsiShapeOption["shape"];
  creationDisabledReason?: string;
  comparisonResults?: readonly AnalysisResult[];
  stabilityPhase?: "pre-fsi" | "post-fsi";
  stabilityFsiShapes?: readonly StabilityFsiShapeOption[];
  introduction?: ReactNode;
  scope?: "wing" | "aircraft";
  aircraft: AircraftGeometry;
  cases: readonly AnalysisCase[];
  results: readonly AnalysisResult[];
  polars: readonly AirfoilPolar[];
  analysisCaseRepository: EntityRepository<AnalysisCase, string>;
  saveAnalysisResult: (result: AnalysisResult) => void;
  analysisRunner?: AircraftAnalysisRunner;
}

type AnalysisJob = Job<string, AnalysisResult, { caseId: string }>;
type EditorMode = "create" | "edit" | null;

export function AnalysisPage(props: AnalysisPageProps) {
  const scope = props.scope ?? "wing";
  return (
    <PageTemplate
      title={scope === "aircraft" ? "安定性設計" : "主翼解析"}
      description={scope === "aircraft" ? "主翼と尾翼を同時に解き、縦・横・方向の静安定性を確認します。" : "主翼単体の LLT / VLM 解析で性能と荷重分布を確認し、設計迎角を選びます。"}
      tabs={scope === "wing" ? <AerodynamicDesignTabs /> : undefined}
      actions={<Link className="text-sm font-medium text-blue-700 underline" to="/aerodynamics/tails">{scope === "aircraft" ? "尾翼設計に戻る" : "尾翼設計に進む"}</Link>}
    >

      <AnalysisWorkspace {...props} />
    </PageTemplate>
  );
}

export function AnalysisWorkspace({ fixedFsiShape, creationDisabledReason, comparisonResults = [], stabilityPhase, stabilityFsiShapes = [], introduction, scope = "wing", aircraft, cases: allCases, results: allResults, polars, analysisCaseRepository, saveAnalysisResult, analysisRunner = webAircraftAnalysisRunner }: AnalysisPageProps) {
  const cases = useMemo(() => allCases.filter((item) => (item.scope ?? "wing") === scope
    && (!stabilityPhase || (stabilityPhase === "post-fsi") === (item.stabilityShape?.kind === "fsi"))), [allCases, scope, stabilityPhase]);
  const results = useMemo(() => allResults.filter((result) => cases.some((item) => item.id === result.caseId)), [allResults, cases]);
  const jobs = useJobs();
  const controllers = useRef(new Map<string, AbortController>());
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [detailCaseId, setDetailCaseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnalysisCaseDraft>(() => createNewDraft(aircraft.id, aircraft.mac / 4, scope, fixedFsiShape));
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
  const displayedResults = [...results.filter((result) => resultView.state.displayedResultIds.includes(result.id)), ...comparisonResults];
  const resultForView = selectedResult ?? displayedResults[0] ?? results[0];
  const selectedJob = jobs.jobs.find((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, selected?.id));
  const hasRun = Boolean(selectedResult && selectedResult.status === "completed");
  const chartData = useMemo(() => resultForView?.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) ?? [], [resultForView]);
  const chartSeries = useMemo(() => displayedResults.map((result, index) => ({ id: result.id, name: result.caseSnapshot?.name ?? cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId, color: ["#2563eb", "#0f766e", "#dc2626", "#7c3aed"][index % 4], data: result.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) })), [cases, displayedResults]);

  const openCreate = () => {
    if (creationDisabledReason) return;
    setDraft(createNewDraft(aircraft.id, aircraft.mac / 4, scope, fixedFsiShape));
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
    const shapeErrors = stabilityShapeErrors(draft.stabilityShape, aircraft.span / 2);
    if (shapeErrors.length) { setErrors({ stabilityShape: shapeErrors.join(" ") }); return; }
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
      const result = await analysisRunner.run({
        analysisCase,
        aircraft,
        polars,
        resultId: createId("analysis-result"),
      }, controller.signal, (progress) => jobs.updateJob<AnalysisJob>(jobId, { progress }));
      saveAnalysisResult(result);
      resultView.show(result.id);
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
    <>
      <div className="space-y-5">
        {introduction}
        <Card><CardHeader className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-950">選択ケースの解析結果</h2><p className="mt-1 text-sm text-slate-500">解析ケース表の「表示」で選んだ結果を同じグラフ上で比較します。</p></div><Badge tone={displayedResults.length ? "green" : "slate"}>{displayedResults.length}件表示</Badge></CardHeader><CardBody>{displayedResults.length ? <div className="space-y-4">{resultForView?.caseSnapshot?.scope === "aircraft" ? <WholeAircraftResults result={resultForView} /> : null}{scope === "aircraft" ? <StabilityComparison results={displayedResults} /> : null}<PolarCharts data={chartData} series={chartSeries} mode="analysis" /></div> : <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">解析済みケースの「表示」を選ぶと、結果グラフがここに表示されます。</p>}</CardBody></Card>
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-slate-950">解析ケース</h2><p className="mt-1 text-sm text-slate-500">条件の確認、編集、再実行、複製、削除を行います。</p></div>
            <Button variant="secondary" size="sm" disabled={Boolean(creationDisabledReason)} title={creationDisabledReason} onClick={openCreate}><Plus size={15} />解析ケースを作成</Button>
          </CardHeader>
          <CardBody>
            {cases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>{["表示", "ケース名", "手法", "対象", ...(scope === "aircraft" ? ["評価形状"] : []), "α sweep", "速度", "高度", "状態"].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}<TableActionHeader /></tr></thead>
              <tbody className="divide-y divide-slate-100">{cases.map((item) => {
                const result = results.find((candidate) => candidate.caseId === item.id);
                const running = jobs.jobs.some((job) => job.kind === "aircraft-analysis" && job.status === "running" && hasCaseId(job, item.id));
                return <tr key={item.id} className={item.id === caseSelection.selectedId ? "bg-blue-50/60" : "hover:bg-slate-50"} onClick={() => caseSelection.select(item.id)}>
                  <td className="px-2 py-3"><input type="checkbox" checked={Boolean(result && resultView.state.displayedResultIds.includes(result.id))} disabled={!result} title={result ? "グラフ表示を切り替え" : "解析結果がありません"} aria-label={`${item.name}をグラフに表示`} onClick={(event) => event.stopPropagation()} onChange={() => { if (result) resultView.state.displayedResultIds.includes(result.id) ? resultView.hide(result.id) : resultView.show(result.id); }} /></td>
                  <td className="px-2 py-3 font-medium text-slate-900">{item.name}</td><td className="px-2 py-3">{item.method}</td><td className="px-2 py-3">{item.scope === "aircraft" ? "全翼面" : "主翼のみ"}</td>{scope === "aircraft" ? <td className="px-2 py-3">{stabilityShapeLabel(item.stabilityShape)}</td> : null}<td className="px-2 py-3">{formatAlphaRange(item.alphaStart, item.alphaEnd, item.alphaStep)}</td><td className="px-2 py-3">{item.speed} m/s</td><td className="px-2 py-3">{item.altitude} m</td><td className="px-2 py-3"><Badge tone={running ? "blue" : result?.status === "completed" ? "green" : "slate"}>{running ? "実行中" : analysisStatusLabel(result?.status ?? item.status)}</Badge></td>
                  <TableActionCell><RowActions entityLabel={item.name} detail={{ onAction: () => { caseSelection.select(item.id); setDetailCaseId(item.id); } }} edit={{ onAction: () => { caseSelection.select(item.id); openEdit(item); } }} rerun={{ disabled: running, disabledReason: running ? "解析を実行中です" : undefined, onAction: () => void runAnalysis(item) }} custom={[{ key: "duplicate", label: "複製", icon: <Copy size={15} />, onAction: () => void duplicateCase(item) }]} delete={{ onAction: () => setPendingDeleteId(item.id) }} /></TableActionCell>
                </tr>;
              })}</tbody>
            </table></div> : <div className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center"><p className="text-sm text-slate-500">解析ケースはまだありません。</p><Button className="mt-4" disabled={Boolean(creationDisabledReason)} title={creationDisabledReason} onClick={openCreate}><Plus size={15} />最初の解析ケースを作成</Button></div>}
          </CardBody>
        </Card>
      </div>

      {editorMode ? <CaseEditor stabilityPhase={stabilityPhase} aircraft={aircraft} fsiShapes={stabilityFsiShapes} draft={draft} errors={errors} title={editorMode === "create" ? "解析ケースを新規作成" : "解析ケースを編集"} onChange={setDraft} onSave={() => void saveCase()} onClose={() => setEditorMode(null)} /> : null}
      <InspectorDrawer open={Boolean(detailCaseId && selected)} title="解析ケース詳細" subtitle={selected?.name} closeLabel="解析ケース詳細を閉じる" width="wide" onClose={() => setDetailCaseId(null)} footer={selected ? <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => openEdit(selected)}>編集</Button>{selectedJob ? <Button variant="destructive" onClick={() => controllers.current.get(selectedJob.id)?.abort()}><X size={16} />解析をキャンセル</Button> : <Button aria-label={`${selected.name}を解析`} onClick={() => void runAnalysis(selected)}><Play size={16} />{hasRun ? "再解析" : "解析を実行"}</Button>}</div> : null}>
        {selected ? <div className="space-y-5"><Card><CardHeader className="flex items-center justify-between"><h3 className="font-semibold text-slate-950">解析設定</h3><Badge tone={hasRun ? "green" : "slate"}>{selectedJob ? "実行中" : hasRun ? "結果あり" : analysisStatusLabel(selected.status)}</Badge></CardHeader><CardBody className="grid gap-3 sm:grid-cols-2"><Setting label="解析手法" value={selected.method} /><Setting label="解析対象" value={selected.scope === "aircraft" ? "全翼面" : "主翼のみ"} /><Setting label="α sweep" value={formatAlphaRange(selected.alphaStart, selected.alphaEnd, selected.alphaStep)} />{selected.scope === "aircraft" ? <><Setting label="横滑り角 β" value={`${selected.beta ?? 0}°`} /><Setting label="重心位置 X" value={`${selected.cgX ?? aircraft.mac / 4} m`} /><Setting label="重心位置 Z" value={`${selected.cgZ ?? 0} m`} /></> : null}<Setting label="速度" value={`${selected.speed} m/s`} /><Setting label="高度" value={`${selected.altitude} m`} /><Setting label="Re" value={selected.reynolds.toLocaleString()} /><Setting label="使用ジオメトリ" value={selected.geometryId} /></CardBody></Card>{selectedJob ? <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{selectedJob.progress?.message ?? "解析を開始しています…"} ({selectedJob.progress?.completed ?? 0}/{selectedJob.progress?.total ?? 0})</p> : null}</div> : null}
      </InspectorDrawer>
      <DeleteConfirmationDialog
        open={pendingDeleteId !== null}
        title="解析ケースを削除しますか？"
        description={results.some((result) => result.caseId === pendingDeleteId) ? "このケースの保存済み結果も削除されます。" : "この操作は元に戻せません。"}
        onConfirm={() => { if (pendingDeleteId) void deleteCase(pendingDeleteId); }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function CaseEditor({ stabilityPhase, aircraft, fsiShapes, draft, errors, title, onChange, onSave, onClose }: { stabilityPhase?: "pre-fsi" | "post-fsi"; aircraft: AircraftGeometry; fsiShapes: readonly StabilityFsiShapeOption[]; draft: AnalysisCaseDraft; errors: Partial<Record<keyof AnalysisCaseDraft, string>>; title: string; onChange: (draft: AnalysisCaseDraft) => void; onSave: () => void; onClose: () => void }) {
  const update = <K extends keyof AnalysisCaseDraft>(field: K, value: AnalysisCaseDraft[K]) => onChange({ ...draft, [field]: value });
  const numberInput = (field: "alphaStart" | "alphaEnd" | "alphaStep" | "speed" | "altitude" | "reynolds", label: string) => <label className="grid gap-1 text-sm text-slate-700"><span>{label}</span><input className="rounded-md border border-slate-300 px-3 py-2" type="number" readOnly={field === "speed" && draft.stabilityShape?.kind === "fsi"} value={draft[field]} onChange={(event) => update(field, Number(event.target.value))} />{errors[field] ? <span className="text-xs text-red-600">{errors[field]}</span> : null}</label>;
  return <InspectorDrawer open title={title} subtitle="LLT / VLM 解析条件" closeLabel="解析ケース編集を閉じる" width="wide" onClose={onClose} footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>キャンセル</Button><Button aria-label="解析ケースを保存" onClick={onSave}>保存</Button></div>}><div className="grid gap-4 sm:grid-cols-2">
    <label className="grid gap-1 text-sm text-slate-700 md:col-span-2"><span>ケース名</span><input className="rounded-md border border-slate-300 px-3 py-2" value={draft.name} onChange={(event) => update("name", event.target.value)} />{errors.name ? <span className="text-xs text-red-600">{errors.name}</span> : null}</label>
    <label className="grid gap-1 text-sm text-slate-700"><span>解析対象</span><select disabled className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2" value={draft.scope ?? "wing"}><option value="wing">主翼のみ</option><option value="aircraft">全翼面</option></select></label>
    <label className="grid gap-1 text-sm text-slate-700"><span>解析手法</span><select className="rounded-md border border-slate-300 px-3 py-2" value={draft.method} onChange={(event) => update("method", event.target.value as AnalysisCase["method"])}><option value="LLT" disabled={draft.scope === "aircraft"}>LLT</option><option value="VLM">VLM</option></select></label>
    <label className="grid gap-1 text-sm text-slate-700"><span>使用ジオメトリ</span><input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2" value={draft.geometryId} readOnly />{errors.geometryId ? <span className="text-xs text-red-600">{errors.geometryId}</span> : null}</label>
    {numberInput("alphaStart", "α 開始 (°)")}{numberInput("alphaEnd", "α 終了 (°)")}{numberInput("alphaStep", "α 刻み (°)")}{draft.scope === "aircraft" ? <><label className="grid gap-1 text-sm text-slate-700"><span>横滑り角 β (°)</span><input type="number" className="rounded-md border border-slate-300 px-3 py-2" value={draft.beta ?? 0} onChange={(event) => update("beta", Number(event.target.value))} />{errors.beta ? <span className="text-xs text-red-600">{errors.beta}</span> : null}</label><label className="grid gap-1 text-sm text-slate-700"><span>重心位置 X (m)</span><input type="number" step="any" className="rounded-md border border-slate-300 px-3 py-2" value={draft.cgX ?? 0} onChange={(event) => update("cgX", Number(event.target.value))} />{errors.cgX ? <span className="text-xs text-red-600">{errors.cgX}</span> : null}</label></> : null}{numberInput("speed", "速度 (m/s)")}{numberInput("altitude", "高度 (m)")}{numberInput("reynolds", "Reynolds 数")}
    {draft.scope === "aircraft" ? <label className="grid gap-1 text-sm text-slate-700"><span>重心位置 Z (m)</span><input type="number" step="any" className="rounded-md border border-slate-300 px-3 py-2" aria-label="重心位置 Z (m)" defaultValue={draft.cgZ ?? 0} onChange={(event) => update("cgZ", event.currentTarget.valueAsNumber)} /><span className="text-xs text-slate-500">主翼根元から上方が正。重心Y位置は0として計算します。</span>{errors.cgZ ? <span className="text-xs text-red-600">{errors.cgZ}</span> : null}</label> : null}
    {draft.scope === "aircraft" ? <>{stabilityPhase === "post-fsi" ? <p className="text-sm text-slate-600 sm:col-span-2">評価形状: FSI後評価（固定形状）。新規ケースは表示中の連成結果を自動で引き継ぎます。</p> : <StabilityShapeEditor allowFsi={stabilityPhase !== "pre-fsi"} shape={draft.stabilityShape} semiSpan={aircraft.span / 2} defaultAxis={aircraft.sparChordFraction ?? 0.35} fsiShapes={fsiShapes} onChange={(shape) => onChange({ ...draft, stabilityShape: shape, ...(shape.kind === "fsi" ? { speed: shape.speed } : {}) })} />}{errors.stabilityShape ? <p role="alert" className="text-sm text-red-700 sm:col-span-2">{errors.stabilityShape}</p> : null}</> : null}
  </div></InspectorDrawer>;
}

function Setting({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-medium text-slate-900">{value}</p></div>; }
function WholeAircraftResults({ result }: { result: AnalysisResult }) {
  const summary = summarizeAircraftStability(result.rows);
  const perRadian = (value: number | null) => value === null ? "未算出（再解析してください）" : `${value.toFixed(3).replace("-", "−")} /rad`;
  const cgX = result.caseSnapshot?.cgX ?? (result.aircraftSnapshot ? result.aircraftSnapshot.mac / 4 : undefined);
  return <div className="space-y-3">
    <p className="text-sm font-medium">評価形状: {stabilityShapeLabel(result.caseSnapshot?.stabilityShape)}</p>
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">全翼面VLMは非粘性の薄翼推定です。CDは誘導抵抗のみです。トリムはCm=0の迎角、安定性は静微係数の目安です。主翼の上反角、後退角、尾翼配置と相互誘導流を含みます。翼型Polar、失速、胴体、質量・必要揚力、操舵余裕は反映しません。ダッチロール・スパイラルなどの動安定性は未評価です。</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Setting label="トリム迎角 (Cm=0)" value={summary.trimAlpha === null ? "掃引範囲外" : `${summary.trimAlpha.toFixed(2)}°`} /><Setting label="トリム時 CL" value={summary.trimCl === null ? "—" : summary.trimCl.toFixed(3)} /><Setting label="静安定余裕 (−dCm/dCL)" value={summary.staticMarginPercent === null ? "算出不可" : `${summary.staticMarginPercent.toFixed(1)}%`} /><Setting label="方向安定微係数 Cnβ" value={summary.cnBetaPerRadian === null ? "算出不可" : `${summary.cnBetaPerRadian.toFixed(3)} /rad`} /></div>
    <div className="grid gap-3 sm:grid-cols-3"><Setting label="縦安定微係数 Cmα" value={summary.cmAlphaPerDegree === null ? "算出不可" : `${summary.cmAlphaPerDegree.toFixed(4)} /deg`} /><Setting label="上反角効果 Crβ" value={perRadian(summary.crBetaPerRadian)} /><Setting label="横力微係数 CYβ" value={perRadian(summary.cyBetaPerRadian)} /></div>
    <p className="text-xs text-slate-500">横・方向微係数の評価迎角: {summary.derivativeAlpha?.toFixed(2) ?? "—"}°（トリム点で補間、トリムがない場合は0°に最も近い解析点）。βは右向きの流入を正、Crは後方を向くX軸まわりの右手系です。通常の前方X軸のClとは符号が逆になります。</p>
    <p className="text-xs text-slate-500">重心位置 X: {typeof cgX === "number" ? cgX.toFixed(3) : "—"} m（主翼根元前縁から後方）、Z: {(result.caseSnapshot?.cgZ ?? 0).toFixed(3)} m（上方）、Y: 0 m。静安定余裕は正なら縦静安定の傾向、Cnβ は正なら方向静安定の傾向を示します。</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><caption className="mb-2 text-left font-medium">全機の力・モーメント係数（主翼面積・スパン・MAC基準、指定重心基準点）</caption><thead className="border-b border-slate-200 text-slate-600"><tr>{["α (°)", "CL", "CY", "CDi", "Cm", "Cr", "Cn", "Crβ (/rad)", "CYβ (/rad)", "Cnβ (/rad)"].map((label) => <th key={label} className="px-2 py-2">{label}</th>)}</tr></thead><tbody>{result.rows.map((row) => <tr key={row.alpha} className="border-b border-slate-100">{[row.alpha, row.cl, row.cy, row.cdi, row.cm, row.cr, row.cn, row.crBeta, row.cyBeta, row.cnBeta].map((value, index) => <td key={index} className="px-2 py-2">{value?.toFixed(index === 0 ? 1 : 4) ?? "—"}</td>)}</tr>)}</tbody></table></div>
  </div>;
}
function createNewDraft(geometryId: string, cgX: number, scope: "wing" | "aircraft", shape?: StabilityFsiShapeOption["shape"]): AnalysisCaseDraft { return { name: "", method: scope === "aircraft" ? "VLM" : "LLT", scope, beta: 0, cgX, cgZ: 0, stabilityShape: shape ? structuredClone(shape) : undefined, alphaStart: shape ? shape.alphaDegrees - 2 : -4, alphaEnd: shape ? shape.alphaDegrees + 2 : 12, alphaStep: 2, speed: shape?.speed ?? 20, altitude: 0, reynolds: 300000, geometryId }; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function countSweepPoints(analysisCase: AnalysisCase) { return Math.floor((analysisCase.alphaEnd - analysisCase.alphaStart) / analysisCase.alphaStep) + 1; }
function formatAlphaRange(start: number, end: number, step: number) { return `${start}° to ${end}° (${step}°刻み)`; }
function analysisStatusLabel(status: "completed" | "not-run" | "needs-review") { return status === "completed" ? "完了" : status === "not-run" ? "未実行" : "要確認"; }
function hasCaseId(job: Job<string, unknown, unknown>, caseId: string | undefined) { return Boolean(caseId && typeof job.settings === "object" && job.settings !== null && "caseId" in job.settings && job.settings.caseId === caseId); }
