import { Download, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { AircraftGeometry } from "../../aircraft/model/types";
import type { CarbonMaterial, StructuralDesign } from "../../structures/model/types";
import type { AirfoilPolar } from "../../airfoils/model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { MetricCard } from "../../../shared/ui/MetricCard";
import { createAeroelasticResultCsv, createAeroelasticResultSummary } from "../services/aeroelasticResultExporter";
import type { StaticAeroelasticResult } from "../services/staticAeroelasticSolver";
import { AeroelasticAnalysisCancelledError, webAeroelasticAnalysisRunner, type AeroelasticAnalysisRunner } from "../services/webAeroelasticAnalysisRunner";
import { useJobs } from "../../../shared/jobs/JobProvider";
import type { Job } from "../../../shared/model";

type AeroelasticJob = Job<string, StaticAeroelasticResult, { structuralDesignId: string }>;

export function AeroelasticAnalysisPanel({
  aircraft,
  materials,
  structuralDesigns,
  results,
  onSaveResult,
  polars = [],
  analysisRunner = webAeroelasticAnalysisRunner,
}: {
  aircraft: AircraftGeometry;
  materials: readonly CarbonMaterial[];
  structuralDesigns: readonly StructuralDesign[];
  results: readonly StaticAeroelasticResult[];
  onSaveResult: (result: StaticAeroelasticResult) => void;
  polars?: readonly AirfoilPolar[];
  analysisRunner?: AeroelasticAnalysisRunner;
}) {
  const jobs = useJobs();
  const controller = useRef<AbortController | null>(null);
  const [designId, setDesignId] = useState(structuralDesigns[0]?.id ?? "");
  const [mode, setMode] = useState<"fixed-alpha" | "target-lift">("fixed-alpha");
  const [alphaDegrees, setAlphaDegrees] = useState(5);
  const [targetLift, setTargetLift] = useState(500);
  const [minimumAlpha, setMinimumAlpha] = useState(-5);
  const [maximumAlpha, setMaximumAlpha] = useState(15);
  const [speed, setSpeed] = useState(7.4);
  const [density, setDensity] = useState(1.225);
  const [elasticAxis, setElasticAxis] = useState(0.4);
  const [localResult, setLocalResult] = useState<StaticAeroelasticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const design = structuralDesigns.find((item) => item.id === designId) ?? structuralDesigns[0];
  const result = localResult ?? results[0];
  const runningJob = jobs.jobs.find((job): job is AeroelasticJob => job.kind === "aeroelastic-analysis" && job.status === "running");
  const unavailableReason = !design
    ? "先に構造設計を作成してください。"
    : !materials.length
      ? "構造設計で使用する材料を作成してください。"
      : null;

  const run = async () => {
    if (!design || runningJob) return;
    setError(null);
    const jobId = createId("job-aeroelastic-analysis");
    const startedAt = new Date().toISOString();
    const nextController = new AbortController();
    controller.current = nextController;
    jobs.createJob<AeroelasticJob>({
      id: jobId,
      kind: "aeroelastic-analysis",
      name: "空力構造連成解析",
      status: "running",
      createdAt: startedAt,
      startedAt,
      progress: { completed: 0, total: 50, message: "連成解析を開始しています…" },
      settings: { structuralDesignId: design.id },
    });
    try {
      const next = await analysisRunner.run({
        resultId: createId("aeroelastic-result"),
        aircraft,
        structuralDesign: design,
        materials,
        polars,
        density,
        speed,
        elasticAxisChordFraction: elasticAxis,
        condition: mode === "fixed-alpha"
          ? { mode, alphaDegrees }
          : { mode, targetLift, minimumAlpha, maximumAlpha },
      }, nextController.signal, (progress) => jobs.updateJob<AeroelasticJob>(jobId, { progress }));
      setLocalResult(next);
      onSaveResult(next);
      jobs.completeJob<AeroelasticJob>(jobId, { result: next, progress: { completed: next.iterations.length, total: next.iterations.length, message: "連成解析が完了しました" } });
    } catch (cause) {
      if (cause instanceof AeroelasticAnalysisCancelledError) jobs.cancelJob(jobId);
      else {
        const message = cause instanceof Error ? cause.message : "空力構造連成解析に失敗しました。";
        setError(message);
        jobs.failJob(jobId, message);
      }
    } finally {
      controller.current = null;
    }
  };

  return <div className="space-y-5">
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold text-slate-950">空力構造連成</h2><p className="mt-1 text-sm text-slate-500">VLM荷重と主翼梁変形を、変形後形状で収束するまで反復します。</p></div>
        {runningJob ? <Button variant="destructive" aria-label="連成解析をキャンセル" onClick={() => controller.current?.abort()}>連成解析をキャンセル</Button> : <Button aria-label="連成解析を実行" disabled={Boolean(unavailableReason)} title={unavailableReason ?? "連成解析を実行"} onClick={() => void run()}><Play size={16} />連成解析を実行</Button>}
      </CardHeader>
      <CardBody className="space-y-4">
        {unavailableReason ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{unavailableReason}</p> : null}
        {runningJob ? <div role="status" aria-live="polite" className="space-y-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800"><div className="flex justify-between gap-3"><span>{runningJob.progress?.message ?? "連成解析を実行中…"}</span><span>{progressPercent(runningJob)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent(runningJob)}%` }} /></div></div> : null}
        {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="構造設計"><select value={design?.id ?? ""} onChange={(event) => setDesignId(event.target.value)}>{structuralDesigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          <Field label="解析モード"><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option value="fixed-alpha">固定迎角</option><option value="target-lift">目標揚力トリム</option></select></Field>
          <NumberField label="速度 (m/s)" value={speed} onChange={setSpeed} />
          <NumberField label="空気密度 (kg/m³)" value={density} step="0.001" onChange={setDensity} />
          <NumberField label="弾性軸位置 (x/c)" value={elasticAxis} step="0.01" onChange={setElasticAxis} />
          {mode === "fixed-alpha"
            ? <NumberField label="迎角 (°)" value={alphaDegrees} step="0.1" onChange={setAlphaDegrees} />
            : <><NumberField label="目標揚力 (N)" value={targetLift} onChange={setTargetLift} /><NumberField label="最小迎角 (°)" value={minimumAlpha} onChange={setMinimumAlpha} /><NumberField label="最大迎角 (°)" value={maximumAlpha} onChange={setMaximumAlpha} /></>}
        </div>
      </CardBody>
    </Card>

    {result ? <AeroelasticResultView result={result} /> : <Card><CardBody><p className="py-8 text-center text-sm text-slate-500">連成解析結果はまだありません。</p></CardBody></Card>}
  </div>;
}

function AeroelasticResultView({ result }: { result: StaticAeroelasticResult }) {
  const sampledPoints = useMemo(() => {
    const step = Math.max(1, Math.ceil(result.structuralResult.points.length / 12));
    return result.structuralResult.points.filter((_, index) => index % step === 0 || index === result.structuralResult.points.length - 1);
  }, [result]);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <MetricCard label="収束状態" value={statusLabel(result.status)} />
      <MetricCard label="迎角" value={`${result.alphaDegrees.toFixed(3)}°`} />
      <MetricCard label="CL / CDi" value={`${result.cl.toFixed(4)} / ${result.cdi.toFixed(5)}`} />
      <MetricCard label="最大たわみ" value={`${result.structuralResult.summary.maxDeflection.toFixed(4)} m`} />
      <MetricCard label="最大ねじれ" value={`${result.structuralResult.summary.maxTwist.toFixed(4)} rad`} />
    </div>
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h3 className="font-semibold text-slate-950">連成結果</h3><Badge tone={result.status === "converged" ? "green" : "amber"}>{statusLabel(result.status)}</Badge>{result.reviewStatus === "needs-review" ? <Badge tone="amber">要確認</Badge> : null}</div><div className="flex gap-2"><Button variant="secondary" size="sm" aria-label="連成結果をCSV出力" onClick={() => download(`${result.id}.csv`, createAeroelasticResultCsv(result), "text/csv;charset=utf-8")}><Download size={15} />CSV</Button><Button variant="secondary" size="sm" aria-label="連成結果をMarkdown出力" onClick={() => download(`${result.id}.md`, createAeroelasticResultSummary(result), "text/markdown;charset=utf-8")}><Download size={15} />Markdown</Button></div></CardHeader>
      <CardBody className="space-y-4">
        <WingDeformationPreview result={result} />
        {result.warnings.map((warning) => <p key={warning} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{warning}</p>)}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{["y", "荷重", "たわみ", "ねじれ", "曲げモーメント", "安全率"].map((item) => <th className="px-2 py-2" key={item}>{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sampledPoints.map((point) => <tr key={point.yPosition}><td className="px-2 py-2">{point.yPosition.toFixed(3)} m</td><td className="px-2 py-2">{point.distributedLoad.toFixed(2)} N/m</td><td className="px-2 py-2">{point.deflection.toFixed(5)} m</td><td className="px-2 py-2">{point.twist.toFixed(5)} rad</td><td className="px-2 py-2">{point.bendingMoment.toFixed(2)} Nm</td><td className="px-2 py-2">{formatFinite(point.minReserveFactor, 2)}</td></tr>)}</tbody></table></div>
      </CardBody>
    </Card>
    <Card><CardHeader><h3 className="font-semibold text-slate-950">反復履歴</h3></CardHeader><CardBody><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{["反復", "迎角", "CL", "総揚力", "変位残差", "荷重残差"].map((item) => <th className="px-2 py-2" key={item}>{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{result.iterations.map((iteration) => <tr key={iteration.iteration}><td className="px-2 py-2">{iteration.iteration}</td><td className="px-2 py-2">{iteration.alphaDegrees.toFixed(3)}°</td><td className="px-2 py-2">{iteration.cl.toFixed(4)}</td><td className="px-2 py-2">{iteration.totalLift.toFixed(2)} N</td><td className="px-2 py-2">{iteration.displacementResidual.toExponential(2)}</td><td className="px-2 py-2">{iteration.loadResidual === null ? "-" : iteration.loadResidual.toExponential(2)}</td></tr>)}</tbody></table></div></CardBody></Card>
  </div>;
}

function WingDeformationPreview({ result }: { result: StaticAeroelasticResult }) {
  const undeformed = quarterChordLine(result.undeformedMesh);
  const deformed = quarterChordLine(result.deformedMesh);
  const all = [...undeformed, ...deformed];
  const span = Math.max(1e-9, ...all.map((point) => point.y));
  const minZ = Math.min(0, ...all.map((point) => point.z));
  const maxZ = Math.max(0, ...all.map((point) => point.z));
  const zRange = Math.max(1e-9, maxZ - minZ);
  const points = (line: typeof all) => line.map((point) => `${20 + point.y / span * 560},${170 - (point.z - minZ) / zRange * 130}`).join(" ");
  return <svg role="img" aria-label="変形前後の主翼形状" viewBox="0 0 600 200" className="h-48 w-full rounded-md border border-slate-200 bg-slate-50">
    <line x1="20" y1="170" x2="580" y2="170" stroke="#cbd5e1" />
    <polyline points={points(undeformed)} fill="none" stroke="#64748b" strokeWidth="3" strokeDasharray="6 5" />
    <polyline points={points(deformed)} fill="none" stroke="#2563eb" strokeWidth="3" />
    <text x="28" y="24" fontSize="12" fill="#64748b">破線: 未変形 / 青: 変形後</text>
  </svg>;
}

function quarterChordLine(mesh: StaticAeroelasticResult["undeformedMesh"]) {
  const candidates = mesh.nodes.filter((node) => node.side === "right" && Math.abs(node.chordFraction - 0.5) < 1e-9);
  const stations = new Map<string, { y: number; z: number }>();
  for (const node of candidates) stations.set(node.y.toFixed(9), { y: node.y, z: node.z });
  return [...stations.values()].sort((left, right) => left.y - right.y);
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return <label className="grid gap-1 text-sm text-slate-700"><span>{label}</span>{<children.type {...children.props} className="rounded-md border border-slate-300 px-3 py-2" />}</label>;
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step?: string; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
}

function statusLabel(status: StaticAeroelasticResult["status"]) { return status === "converged" ? "収束" : status === "max-iterations" ? "最大反復" : "発散"; }
function progressPercent(job: AeroelasticJob) { return job.progress && job.progress.total > 0 ? Math.round(job.progress.completed / job.progress.total * 100) : 0; }
function formatFinite(value: number, digits: number) { return Number.isFinite(value) ? value.toFixed(digits) : "∞"; }
function createId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function download(filename: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
