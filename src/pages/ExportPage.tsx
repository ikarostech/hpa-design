import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import type { DesignDocument } from "../app/designDocument";
import { analysisResultExporter, createDesignSummary } from "../features/analysis/services/analysisResultExporter";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

export function ExportPage({ document, onExportDocument }: { document: DesignDocument; onExportDocument: () => void }) {
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>(() => document.analysisResults.map((result) => result.id));
  useEffect(() => setSelectedResultIds((current) => current.filter((id) => document.analysisResults.some((result) => result.id === id))), [document.analysisResults]);
  const selected = new Set(selectedResultIds);
  const exportInput = { designName: document.name, results: document.analysisResults, selectedResultIds };

  const downloadResults = async (kind: "csv" | "json") => {
    const file = kind === "csv" ? await analysisResultExporter.export(exportInput) : await analysisResultExporter.exportJson(exportInput);
    downloadFile(file);
  };

  return <PageTemplate title="設計ファイルの入出力" description="設計全体の JSON と、選択した解析結果を別々に出力します。">
    <div className="grid gap-5 lg:grid-cols-3">
      <ExportCard title="設計ファイル JSON" detail="翼型、機体、解析ケースと結果を 1 つの設計ファイルに保存します。" icon={<FileJson size={22} />} action="設計ファイルを書き出す" onClick={onExportDocument} />
      <ExportCard title="選択結果 CSV" detail="選択した結果の sweep 行を固定列・UTF-8 BOM で出力します。" icon={<FileSpreadsheet size={22} />} action="CSV を書き出す" onClick={selectedResultIds.length ? () => void downloadResults("csv") : undefined} />
      <ExportCard title="設計サマリー" detail="設計名と各解析ケースの主な指標を Markdown で出力します。" icon={<Download size={22} />} action="サマリーを書き出す" onClick={() => downloadFile({ fileName: "design-summary.md", mimeType: "text/markdown;charset=utf-8", content: createDesignSummary(document) })} />
    </div>
    <Card><CardHeader className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">解析結果の選択</h2><p className="mt-1 text-sm text-slate-500">CSV と JSON には、ここで選択した結果だけを含めます。</p></div><Button variant="secondary" size="sm" disabled={!selectedResultIds.length} onClick={() => void downloadResults("json")}><FileJson size={15} />選択結果 JSON</Button></CardHeader><CardBody>
      {document.analysisResults.length ? <div className="space-y-2">{document.analysisResults.map((result) => <label key={result.id} className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><span className="flex items-center gap-3"><input type="checkbox" checked={selected.has(result.id)} onChange={() => setSelectedResultIds((current) => current.includes(result.id) ? current.filter((id) => id !== result.id) : [...current, result.id])} />{document.analysisCases.find((analysisCase) => analysisCase.id === result.caseId)?.name ?? result.caseId}</span><span>CLmax {result.clMax.toFixed(3)} / 最大 L/D {result.maxLD.toFixed(2)}</span></label>)}</div> : <p className="text-sm text-slate-500">出力できる解析結果はまだありません。</p>}
    </CardBody></Card>
    <Card><CardHeader><h2 className="font-semibold text-slate-950">運用方法</h2></CardHeader><CardBody><p className="text-sm leading-6 text-slate-600">静的ホスティングではサーバーに保存せず、設計ファイルをローカルで管理します。編集後は JSON を書き出して Git などで履歴管理できます。</p></CardBody></Card>
  </PageTemplate>;
}

function ExportCard({ title, detail, icon, action, onClick }: { title: string; detail: string; icon: React.ReactNode; action: string; onClick?: () => void }) {
  return <Card><CardBody><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{detail}</p><Button className="mt-4 w-full" variant="secondary" onClick={onClick} disabled={!onClick}>{action}</Button></CardBody></Card>;
}

function downloadFile(file: { fileName: string; mimeType: string; content: string }) {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
