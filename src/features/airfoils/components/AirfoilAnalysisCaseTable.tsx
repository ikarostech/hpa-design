import { ChevronDown, Download, Info, Play, RotateCcw, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { ResultViewController } from "@/shared/model";
import type { Airfoil, AirfoilAnalysisRun } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilAnalysisCaseTableProps {
  runs: AirfoilAnalysisRun[];
  airfoils: Airfoil[];
  displayedRuns: ResultViewController<string>;
  comparisonLimitReached: boolean;
  maxComparisonRuns: number;
  onCreateRun: () => void;
  onOpenDetail: (run: AirfoilAnalysisRun) => void;
  onRetryRun: (run: AirfoilAnalysisRun) => void;
  onDuplicateRun: (run: AirfoilAnalysisRun) => void;
  onRenameRun: (run: AirfoilAnalysisRun, name: string) => void;
  onDeleteRun: (run: AirfoilAnalysisRun) => void;
  onExportRun: (run: AirfoilAnalysisRun, format: "csv" | "json") => void;
}

interface ExportMenuState {
  runId: string;
  left: number;
  top: number;
}

export function AirfoilAnalysisCaseTable(props: AirfoilAnalysisCaseTableProps) {
  const {
    runs,
    airfoils,
    displayedRuns,
    comparisonLimitReached,
    maxComparisonRuns,
    onCreateRun,
    onOpenDetail,
    onRetryRun,
    onDuplicateRun,
    onRenameRun,
    onDeleteRun,
    onExportRun,
  } = props;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AirfoilAnalysisRun["status"]>("all");
  const [sort, setSort] = useState<"newest" | "reynolds" | "mach">("newest");
  const [exportMenu, setExportMenu] = useState<ExportMenuState | null>(null);
  const selectedRunId = displayedRuns.state.primaryResultId;
  const exportRun = exportMenu ? runs.find((run) => run.id === exportMenu.runId) ?? null : null;
  const filteredRuns = useMemo(() => runs
    .filter((run) => {
      const airfoilNames = run.airfoilIds
        .map((id) => airfoils.find((airfoil) => airfoil.id === id)?.name ?? id)
        .join(" ");
      return (status === "all" || run.status === status)
        && `${run.name} ${airfoilNames} ${run.reynolds} ${run.mach}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((left, right) => {
      if (sort === "newest") return right.createdAt.localeCompare(left.createdAt);
      return sort === "reynolds" ? right.reynolds - left.reynolds : right.mach - left.mach;
    }), [airfoils, query, runs, sort, status]);
  const getAirfoilNames = (ids: string[]) => ids
    .map((id) => airfoils.find((airfoil) => airfoil.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return <>
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">解析 Run</h2>
            <p className="mt-1 text-sm text-slate-500">表示、主Run、履歴、出力を管理します。</p>
          </div>
          <Button variant="secondary" onClick={onCreateRun}><Play size={15} />解析を開始</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Run を検索" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="翼型、Re、Mach、Run 名" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select aria-label="Run の状態で絞り込み" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="all">すべての状態</option><option value="complete">完了</option><option value="needs-review">要確認</option>
          </select>
          <select aria-label="Run の並び順" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="newest">新しい順</option><option value="reynolds">Reynolds 順</option><option value="mach">Mach 順</option>
          </select>
        </div>
        {comparisonLimitReached ? <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">比較は最大 {maxComparisonRuns} Run です。1つ外してから追加してください。</p> : null}
      </CardHeader>
      <CardBody>
        {filteredRuns.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr>{["表示", "主Run", "Run名・日時", "翼型", "Re", "Mach", "α範囲", "状態・操作"].map((heading) => <th key={heading} className={`px-2 py-2 ${heading === "状態・操作" ? "text-right" : ""}`}>{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRuns.map((run) => <Fragment key={run.id}>
                <tr className={selectedRunId === run.id ? "bg-blue-50/60" : "hover:bg-slate-50"} onClick={() => displayedRuns.setPrimary(run.id)}>
                  <td className="px-2 py-3"><input type="checkbox" checked={displayedRuns.state.displayedResultIds.includes(run.id)} aria-label={`${run.name}をグラフに表示`} onClick={(event) => event.stopPropagation()} onChange={() => displayedRuns.state.displayedResultIds.includes(run.id) ? displayedRuns.hide(run.id) : displayedRuns.show(run.id)} /></td>
                  <td className="px-2 py-3"><input type="radio" checked={selectedRunId === run.id} aria-label={`${run.name}を主Runにする`} onClick={(event) => event.stopPropagation()} onChange={() => displayedRuns.setPrimary(run.id)} /></td>
                  <td className="px-2 py-3"><input aria-label={`${run.name}の名前`} className="w-36 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-blue-400" value={run.name} onClick={(event) => event.stopPropagation()} onChange={(event) => onRenameRun(run, event.target.value)} /><div className="mt-1 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</div></td>
                  <td className="px-2 py-3">{getAirfoilNames(run.airfoilIds)}</td><td className="px-2 py-3">{run.reynolds.toLocaleString()}</td><td className="px-2 py-3">{run.mach}</td><td className="px-2 py-3">{formatAlphaRange(run.alphaStart, run.alphaEnd, run.alphaStep)}</td>
                  <td className="px-2 py-3"><div className="flex items-center justify-end gap-1">
                    <Badge tone={run.status === "complete" ? "green" : "amber"}>{run.status === "complete" ? "完了" : "要確認"}</Badge>
                    <Button aria-label={`${run.name}を詳細表示`} title="詳細" size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); onOpenDetail(run); }}><Info size={15} /></Button>
                    <Button aria-label={`${run.name}を再実行`} title="再実行" size="icon" variant="ghost" onClick={(event) => { event.stopPropagation(); onDuplicateRun(run); }}><RotateCcw size={15} /></Button>
                    <Button aria-label={`${run.name}を出力形式から選択`} title="出力形式を選択" aria-haspopup="menu" aria-expanded={exportMenu?.runId === run.id} size="sm" variant="ghost" className="gap-0 px-2" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setExportMenu((current) => current?.runId === run.id ? null : { runId: run.id, left: rect.right, top: rect.top }); }}><Download size={15} /><ChevronDown size={13} /></Button>
                    <Button aria-label={`${run.name}を削除`} title="削除" size="icon" variant="destructive" onClick={(event) => { event.stopPropagation(); onDeleteRun(run); }}><Trash2 size={15} /></Button>
                  </div></td>
                </tr>
                {run.failures?.length ? <tr className="bg-amber-50"><td colSpan={8} className="px-3 py-2 text-xs text-amber-800"><div className="flex items-center justify-between gap-3"><span>失敗: {run.failures.map((failure) => `${airfoils.find((airfoil) => airfoil.id === failure.airfoilId)?.name ?? failure.airfoilId} — ${failure.message}`).join(" / ")}</span><Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); onRetryRun(run); }}><RotateCcw size={14} />失敗分を再試行</Button></div></td></tr> : null}
              </Fragment>)}
            </tbody>
          </table>
        </div> : <p className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">条件に一致する解析 Run はありません。解析を開始して結果を追加してください。</p>}
      </CardBody>
    </Card>
    {exportMenu && exportRun ? <div role="menu" aria-label={`${exportRun.name}の出力形式`} className="fixed z-50 w-28 rounded-md border border-slate-200 bg-white p-1 shadow-lg" style={{ left: exportMenu.left, top: exportMenu.top, transform: "translate(-100%, calc(-100% - 4px))" }}>
      <button role="menuitem" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100" onClick={() => { onExportRun(exportRun, "csv"); setExportMenu(null); }}>CSV</button>
      <button role="menuitem" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100" onClick={() => { onExportRun(exportRun, "json"); setExportMenu(null); }}>JSON</button>
    </div> : null}
  </>;
}

function formatAlphaRange(start: number, end: number, step: number) {
  return `${start}° to ${end}° (${step}° step)`;
}
