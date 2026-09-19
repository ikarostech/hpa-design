import { useEffect, useMemo, useState } from "react";
import type { AnalysisCase, AnalysisResult } from "../features/analysis/model/types";
import { formatAnalysisNumber } from "../features/analysis/services/analysisResultExporter";
import { PolarCharts } from "../features/airfoils/components/PolarCharts";
import type { StructuralAnalysisResult } from "../features/structures/model/types";
import type { ResultViewController } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { IntegratedSpanwiseCharts } from "./components/IntegratedSpanwiseCharts";

interface ResultsPageProps {
  cases: readonly AnalysisCase[];
  results: readonly AnalysisResult[];
  structuralResults: readonly StructuralAnalysisResult[];
}

export function ResultsPage({ cases, results, structuralResults }: ResultsPageProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [displayedResultIds, setDisplayedResultIds] = useState<string[]>(() => results[0] ? [results[0].id] : []);
  const [selectedStructuralResultId, setSelectedStructuralResultId] = useState<string | null>(structuralResults[0]?.id ?? null);
  const [selectedAerodynamicAlpha, setSelectedAerodynamicAlpha] = useState<number | null>(() => preferredAerodynamicRow(results[0])?.alpha ?? null);

  useEffect(() => {
    if (!selectedCaseId || !cases.some((item) => item.id === selectedCaseId)) setSelectedCaseId(cases[0]?.id ?? null);
  }, [cases, selectedCaseId]);
  useEffect(() => {
    setDisplayedResultIds((current) => current.filter((id) => results.some((result) => result.id === id)));
  }, [results]);

  const selected = cases.find((item) => item.id === selectedCaseId) ?? cases[0];
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
  const aerodynamicRows = resultForView?.rows.filter((row) => row.spanwise) ?? [];
  const selectedAerodynamicRow = aerodynamicRows.find((row) => row.alpha === selectedAerodynamicAlpha) ?? preferredAerodynamicRow(resultForView);
  const selectedStructuralResult = structuralResults.find((result) => result.id === selectedStructuralResultId) ?? structuralResults[0];
  const chartData = useMemo(() => resultForView?.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) ?? [], [resultForView]);
  const chartSeries = useMemo(() => displayedResults.map((result, index) => ({ id: result.id, name: cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId, color: ["#2563eb", "#0f766e", "#dc2626", "#7c3aed"][index % 4], data: result.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })) })), [cases, displayedResults]);

  useEffect(() => {
    setSelectedAerodynamicAlpha((current) => resultForView?.rows.some((row) => row.spanwise && row.alpha === current)
      ? current
      : preferredAerodynamicRow(resultForView)?.alpha ?? null);
  }, [resultForView]);

  useEffect(() => {
    setSelectedStructuralResultId((current) => {
      const linked = structuralResults.find((result) => result.loadCaseSnapshot.aerodynamicResultId === resultForView?.id
        && (result.loadCaseSnapshot.aerodynamicAlphaDegrees === undefined || result.loadCaseSnapshot.aerodynamicAlphaDegrees === selectedAerodynamicRow?.alpha));
      if (linked) return linked.id;
      return structuralResults.some((result) => result.id === current) ? current : structuralResults[0]?.id ?? null;
    });
  }, [resultForView?.id, selectedAerodynamicRow?.alpha, structuralResults]);

  return <PageTemplate title="結果" description="空力解析と構造解析の結果を比較し、翼幅方向の分布をまとめて確認します。">
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="CLmax" value={resultForView ? formatAnalysisNumber(resultForView.clMax, 3) : "-"} />
        <MetricCard label="CDmin" value={resultForView ? formatAnalysisNumber(resultForView.cdMin, 6) : "-"} />
        <MetricCard label="最大 L/D" value={resultForView ? formatAnalysisNumber(resultForView.maxLD, 2) : "-"} />
        <MetricCard label="Cm0" value={resultForView ? formatAnalysisNumber(resultForView.cm0, 4) : "-"} />
        <MetricCard label="実行状態" value={analysisStatusLabel(resultForView?.status ?? "not-run")} />
      </div>
      <Card><CardHeader><h2 className="font-semibold text-slate-950">結果グラフ</h2></CardHeader><CardBody><PolarCharts data={chartData} series={chartSeries} mode="analysis" /></CardBody></Card>
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-slate-950">空力・構造 統合結果</h2><p className="mt-1 text-sm text-slate-500">空力解析と、その荷重を使用した構造解析の結果をまとめて確認します。</p></div>
          <div className="flex flex-wrap gap-2">
            {aerodynamicRows.length ? <select aria-label="空力運用点" value={selectedAerodynamicRow?.alpha ?? ""} onChange={(event) => setSelectedAerodynamicAlpha(Number(event.target.value))} className="h-9 rounded border bg-white px-3 text-sm">
              {aerodynamicRows.map((row) => <option key={row.alpha} value={row.alpha}>α {row.alpha.toFixed(1)}° / CL {row.cl.toFixed(3)} / CD {row.cd.toFixed(5)}</option>)}
            </select> : null}
            {structuralResults.length ? <select aria-label="構造解析結果" value={selectedStructuralResult?.id ?? ""} onChange={(event) => setSelectedStructuralResultId(event.target.value)} className="h-9 rounded border bg-white px-3 text-sm">
              {structuralResults.map((result) => <option key={result.id} value={result.id}>{result.designSnapshot.name} / {result.loadCaseSnapshot.name} / {new Date(result.createdAt).toLocaleString("ja-JP")}</option>)}
            </select> : null}
          </div>
        </CardHeader>
        <CardBody>{selectedStructuralResult ? <div className="space-y-4">
          <IntegratedResultSummary aerodynamicResult={resultForView} alphaDegrees={selectedAerodynamicRow?.alpha} structuralResult={selectedStructuralResult} />
          <IntegratedSpanwiseCharts aerodynamicResult={resultForView} alphaDegrees={selectedAerodynamicRow?.alpha} structuralResult={selectedStructuralResult} />
        </div> : <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">構造解析結果はまだありません。構造設計ページで荷重ケースを解析してください。</p>}</CardBody>
      </Card>
      <Card><CardHeader><h2 className="font-semibold text-slate-950">結果一覧</h2></CardHeader><CardBody><ResultTable result={resultForView} /></CardBody></Card>
      <AnalysisResultComparison results={results} cases={cases} resultView={resultView} />
    </div>
  </PageTemplate>;
}

function AnalysisResultComparison({ results, cases, resultView }: { results: readonly AnalysisResult[]; cases: readonly AnalysisCase[]; resultView: ResultViewController<string> }) {
  const displayed = new Set(resultView.state.displayedResultIds);
  return <Card><CardHeader><h2 className="font-semibold text-slate-950">比較する結果</h2><p className="mt-1 text-sm text-slate-500">表示を複数選ぶとグラフを比較できます。指標と表は選択中の解析ケースに従います。</p></CardHeader><CardBody className="space-y-2">{results.length ? results.map((result) => <div key={result.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={displayed.has(result.id)} aria-label={`${result.id}を比較に表示`} onChange={() => displayed.has(result.id) ? resultView.hide(result.id) : resultView.show(result.id)} /><span>{cases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId}</span><span>CLmax {formatAnalysisNumber(result.clMax, 3)} / L/D {formatAnalysisNumber(result.maxLD, 2)}</span></div>) : <p className="text-sm text-slate-500">比較できる解析結果はまだありません。</p>}</CardBody></Card>;
}

function IntegratedResultSummary({ aerodynamicResult, alphaDegrees, structuralResult }: { aerodynamicResult: AnalysisResult | undefined; alphaDegrees?: number; structuralResult: StructuralAnalysisResult }) {
  const resultLinked = Boolean(aerodynamicResult && structuralResult.loadCaseSnapshot.aerodynamicResultId === aerodynamicResult.id);
  const operatingPointLinked = resultLinked && structuralResult.loadCaseSnapshot.aerodynamicAlphaDegrees !== undefined && structuralResult.loadCaseSnapshot.aerodynamicAlphaDegrees === alphaDegrees;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={operatingPointLinked ? "green" : resultLinked ? "blue" : "amber"}>{operatingPointLinked ? "空力運用点と関連付け済み" : resultLinked ? "空力結果と関連付け済み" : "個別選択"}</Badge>
      <span className="text-slate-500">構造荷重: {structuralResult.loadCaseSnapshot.name}</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="空力結果" value={aerodynamicResult?.caseSnapshot?.name ?? aerodynamicResult?.caseId ?? "-"} detail={aerodynamicResult ? `CLmax ${formatAnalysisNumber(aerodynamicResult.clMax, 3)} / CDmin ${formatAnalysisNumber(aerodynamicResult.cdMin, 5)}` : "未選択"} />
      <MetricCard label="構造設計" value={structuralResult.designSnapshot.name} detail={structuralResult.loadCaseSnapshot.name} />
      <MetricCard label="最小安全率" value={formatAnalysisNumber(structuralResult.summary.minReserveFactor, 2)} detail={`${structuralResult.summary.governingPosition.toFixed(2)} m / ${displayFailureMode(structuralResult.summary.governingMode)}`} />
      <MetricCard label="最大変形" value={`${(structuralResult.summary.maxDeflection * 1000).toFixed(1)} mm`} detail={`ねじれ ${structuralResult.summary.maxTwist.toFixed(2)}°`} />
    </div>
  </div>;
}

function ResultTable({ result }: { result: AnalysisResult | undefined }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{["α", "CL", "CD", "Cm", "L/D", "状態"].map((header) => <th key={header} className="px-2 py-2">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(result?.rows ?? []).map((row) => <tr key={`${row.caseId}-${row.alpha}`}><td className="px-2 py-3">{formatAnalysisNumber(row.alpha, 1)}°</td><td className="px-2 py-3">{formatAnalysisNumber(row.cl, 4)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.cd, 6)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.cm, 4)}</td><td className="px-2 py-3">{formatAnalysisNumber(row.ld, 2)}</td><td className="px-2 py-3"><Badge tone={row.status === "completed" ? "green" : "amber"}>{analysisStatusLabel(row.status)}</Badge></td></tr>)}</tbody></table>{!result ? <p className="px-2 py-5 text-sm text-slate-500">実行結果はまだありません。</p> : null}</div>;
}

function analysisStatusLabel(status: "completed" | "not-run" | "needs-review") { return status === "completed" ? "完了" : status === "not-run" ? "未実行" : "要確認"; }
function preferredAerodynamicRow(result: AnalysisResult | undefined) { return [...(result?.rows ?? [])].filter((row) => row.spanwise).sort((left, right) => right.cl - left.cl)[0]; }
function displayFailureMode(mode: string) { return mode === "Excel準拠曲げ" ? "曲げ" : mode; }
