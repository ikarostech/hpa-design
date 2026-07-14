import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";

export function ExportPage({ onExport }: { onExport: () => void }) {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-semibold text-slate-950">設計ファイルの入出力</h1><p className="mt-1 text-sm text-slate-500">JSON ファイルを保存し、次回はダッシュボードから読み込みます。</p></div>
      <div className="grid gap-5 lg:grid-cols-3">
        <ExportCard title="設計ファイル JSON" detail="翼型、機体、解析ケースと結果を 1 つの設計ファイルに保存します。" icon={<FileJson size={22} />} action="設計ファイルを書き出す" onClick={onExport} />
        <ExportCard title="解析結果 CSV" detail="解析結果を表形式で出力します。" icon={<FileSpreadsheet size={22} />} action="今後対応" />
        <ExportCard title="設計サマリー" detail="設計条件と未対応項目をまとめて出力します。" icon={<Download size={22} />} action="今後対応" />
      </div>
      <Card><CardHeader><h2 className="font-semibold text-slate-950">運用方法</h2></CardHeader><CardBody><p className="text-sm leading-6 text-slate-600">静的ホスティングではサーバーに保存せず、設計ファイルをローカルで管理します。編集後は JSON を書き出して Git などで履歴管理できます。</p></CardBody></Card>
    </div>
  );
}

function ExportCard({ title, detail, icon, action, onClick }: { title: string; detail: string; icon: React.ReactNode; action: string; onClick?: () => void }) {
  return <Card><CardBody><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{detail}</p><Button className="mt-4 w-full" variant="secondary" onClick={onClick} disabled={!onClick}>{action}</Button></CardBody></Card>;
}
