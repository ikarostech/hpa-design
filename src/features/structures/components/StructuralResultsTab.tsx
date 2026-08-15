import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { MetricCard } from "../../../shared/ui/MetricCard";
import type { StructuralAnalysisResult } from "../model/types";
import { createStructuralResultCsv, createStructuralSummary } from "../services/structuralLoadService";
import { formatStructuralNumber, StructuralResultChart } from "./StructuralResultChart";

type ResultQuantity = "shearForce" | "bendingMoment" | "torque" | "deflection" | "twist" | "minReserveFactor";

export function StructuralResultsTab({ results, result, onSelectResult }: {
  results: readonly StructuralAnalysisResult[];
  result: StructuralAnalysisResult | undefined;
  onSelectResult: (id: string) => void;
}) {
  const [quantity, setQuantity] = useState<ResultQuantity>("bendingMoment");
  const chart = useMemo(
    () => result?.points.map((point) => ({ x: point.yPosition, value: point[quantity] })) ?? [],
    [quantity, result],
  );

  if (!result) {
    return <Card><CardBody><p className="text-sm text-slate-500">構造解析結果はまだありません。荷重ケースから解析を実行してください。</p></CardBody></Card>;
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <select aria-label="構造解析結果" value={result.id} onChange={(event) => onSelectResult(event.target.value)} className="h-9 rounded border bg-white px-3 text-sm">
        {results.map((item) => <option key={item.id} value={item.id}>{item.loadCaseSnapshot.name} / {new Date(item.createdAt).toLocaleString("ja-JP")}</option>)}
      </select>
      <div className="flex gap-2">
        <Button variant="secondary" aria-label="構造結果CSVを保存" onClick={() => download(`${result.designSnapshot.name}.csv`, "text/csv;charset=utf-8", createStructuralResultCsv(result))}><Download size={16} />CSV</Button>
        <Button variant="secondary" onClick={() => download(`${result.designSnapshot.name}.md`, "text/markdown;charset=utf-8", createStructuralSummary(result))}><Download size={16} />サマリー</Button>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard label="最小RF" value={formatStructuralNumber(result.summary.minReserveFactor, 2)} detail={`${result.summary.governingPosition.toFixed(2)} m / ${result.summary.governingMode}`} />
      <MetricCard label="最大たわみ" value={`${(result.summary.maxDeflection * 1000).toFixed(1)} mm`} />
      <MetricCard label="最大ねじれ" value={`${(result.summary.maxTwist * 180 / Math.PI).toFixed(2)}°`} />
      <MetricCard label="パイプ重量" value={`${result.summary.mass.toFixed(3)} kg`} detail="片翼" />
      <MetricCard label="支配ケース" value={result.summary.governingLoadCase} detail={statusLabel(result.status)} />
    </div>
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="font-semibold">翼幅方向結果</h2>
        <select aria-label="表示量" value={quantity} onChange={(event) => setQuantity(event.target.value as ResultQuantity)} className="h-8 rounded border bg-white px-2 text-sm">
          <option value="shearForce">せん断力</option><option value="bendingMoment">曲げモーメント</option><option value="torque">ねじりモーメント</option><option value="deflection">たわみ</option><option value="twist">ねじれ</option><option value="minReserveFactor">リザーブファクター</option>
        </select>
      </CardHeader>
      <CardBody><StructuralResultChart points={chart} label={quantity} /></CardBody>
    </Card>
    <Card>
      <CardHeader><h2 className="font-semibold">断面別結果</h2></CardHeader>
      <CardBody><div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs text-slate-500"><tr><th className="px-2 py-2">Y</th><th>荷重</th><th>せん断力</th><th>曲げ</th><th>たわみ</th><th>ねじれ</th><th>軸応力</th><th>せん断応力</th><th>RF</th><th>支配層</th></tr></thead>
        <tbody>{result.points.filter((_, index) => index % Math.max(1, Math.floor(result.points.length / 30)) === 0).map((point) => <tr key={point.yPosition} className="border-t"><td className="px-2 py-2">{point.yPosition.toFixed(3)}</td><td>{point.distributedLoad.toFixed(1)}</td><td>{point.shearForce.toFixed(1)}</td><td>{point.bendingMoment.toFixed(1)}</td><td>{(point.deflection * 1000).toFixed(2)} mm</td><td>{(point.twist * 180 / Math.PI).toFixed(3)}°</td><td>{(point.axialStress / 1e6).toFixed(1)} MPa</td><td>{(point.shearStress / 1e6).toFixed(1)} MPa</td><td>{formatStructuralNumber(point.minReserveFactor, 2)}</td><td>{point.criticalPlyId}</td></tr>)}</tbody>
      </table></div></CardBody>
    </Card>
  </div>;
}

function statusLabel(status: "not-run" | "completed" | "needs-review") {
  return status === "completed" ? "完了" : status === "needs-review" ? "要確認" : "未実行";
}

function download(fileName: string, mimeType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
