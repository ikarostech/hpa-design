import { ArrowRight, Download, FileUp, Library, Plane, Radar } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { DesignDocument } from "../app/designDocument";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";

interface DashboardPageProps {
  document: DesignDocument;
  onImportFile: (file: File) => Promise<void>;
  onExport: () => void;
}

export function DashboardPage({ document, onImportFile, onExport }: DashboardPageProps) {
  const navigate = useNavigate();
  const [importError, setImportError] = useState<string | null>(null);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      await onImportFile(file);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "設計ファイルを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">設計概要</h1>
          <p className="mt-1 text-sm text-slate-500">現在開いている設計ファイルを編集します。プロジェクトの切り替えはありません。</p>
        </div>
        <Button onClick={() => navigate("/airfoils")}>翼型を編集 <ArrowRight size={16} /></Button>
      </div>

      <Card className="overflow-hidden">
        <CardBody className="grid gap-5 bg-gradient-to-br from-blue-600 to-sky-500 p-6 text-white md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm text-blue-100">現在の設計ファイル</p>
            <h2 className="mt-1 text-3xl font-semibold">{document.name}</h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">GitHub Pages などの静的ホスティングでも、JSON ファイルを読み込み、ブラウザ内で設計を編集して再び書き出せます。</p>
          </div>
          <div className="flex flex-wrap content-start gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50">
              <FileUp size={16} /> 設計ファイルを読み込む
              <input className="sr-only" type="file" accept="application/json,.json" onChange={importFile} />
            </label>
            <Button variant="secondary" onClick={onExport}><Download size={16} /> 設計ファイルを書き出す</Button>
          </div>
        </CardBody>
      </Card>

      {importError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{importError}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="翼型" value={document.airfoils.length.toString()} detail="現在のライブラリ" icon={<Library size={18} />} />
        <MetricCard label="Polar" value={document.polars.length.toString()} detail="翼型解析結果" icon={<Radar size={18} />} />
        <MetricCard label="機体" value={`${document.aircraft.wingArea.toFixed(2)} m²`} detail={`翼幅 ${document.aircraft.span.toFixed(2)} m`} icon={<Plane size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <ActionCard title="1. 翼型と Polar" detail="翼型を追加し、XFOIL 解析で Polar を作成します。" action="翼型へ" onClick={() => navigate("/airfoils")} />
        <ActionCard title="2. 機体設計" detail="主翼形状と翼型の割り当てを編集します。" action="機体設計へ" onClick={() => navigate("/aircraft")} />
        <ActionCard title="3. 解析と保存" detail="解析結果を確認し、設計ファイルとして保存します。" action="入出力へ" onClick={() => navigate("/export")} />
      </div>
    </div>
  );
}

function ActionCard({ title, detail, action, onClick }: { title: string; detail: string; action: string; onClick: () => void }) {
  return <Card><CardHeader><h2 className="font-semibold text-slate-950">{title}</h2></CardHeader><CardBody><p className="min-h-12 text-sm text-slate-500">{detail}</p><Button className="mt-4 w-full" variant="secondary" onClick={onClick}>{action}</Button></CardBody></Card>;
}
