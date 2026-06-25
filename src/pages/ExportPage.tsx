import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";

export function ExportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">エクスポート</h1>
        <p className="mt-1 text-sm text-slate-500">MVP1では解析結果とジオメトリの簡易出力だけを表示します。</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <ExportCard title="解析結果 CSV" detail="CL/CD/Cm/L/DテーブルをCSVとして保存" icon={<FileSpreadsheet size={22} />} />
        <ExportCard title="プロジェクト JSON" detail="翼型、機体、解析ケースをJSONで保存" icon={<FileJson size={22} />} />
        <ExportCard title="設計サマリー" detail="主要寸法と未完了条件をまとめて出力" icon={<Download size={22} />} />
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold text-slate-950">未完了条件</h2></CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          {["Polar未作成の翼型があります", "重心未設定", "トリム解析はMVP2で対応"].map((item) => (
            <div key={item} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{item}</div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function ExportCard({ title, detail, icon }: { title: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</div>
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{detail}</p>
        <Button className="mt-4 w-full" variant="secondary">出力</Button>
      </CardBody>
    </Card>
  );
}
