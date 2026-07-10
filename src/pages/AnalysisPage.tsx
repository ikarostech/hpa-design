import { Download, RotateCcw, Save, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AircraftPreview } from "../features/aircraft/components/AircraftPreview";
import { PolarCharts } from "../features/airfoils/components/PolarCharts";
import { analysisCases, analysisResult } from "../mocks/mockData";
import type { SingleSelection } from "../shared/model";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";
import { MetricCard } from "../shared/ui/MetricCard";

export function AnalysisPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selectedCase, setSelectedCase] = useState(analysisCases[0].id);
  const [hasRun, setHasRun] = useState(true);
  const caseSelection: SingleSelection<string> = {
    selectedId: selectedCase,
    select: setSelectedCase,
    clear: () => setSelectedCase(analysisCases[0].id),
  };
  const selected = analysisCases.find((item) => item.id === caseSelection.selectedId) ?? analysisCases[0];
  const chartData = useMemo(() => analysisResult.rows.map(({ alpha, cl, cd, cm }) => ({ alpha, cl, cd, cm })), []);
  const activeTab = params.get("tab") === "results" ? "結果" : "解析";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">解析ケースと結果</h1>
        <p className="mt-1 text-sm text-slate-500">LLT/VLM風の簡易解析ケースを実行し、結果の形状を確認します。</p>
      </div>
      <div className="flex gap-2 border-b border-slate-200">
        {["解析", "結果"].map((tab) => (
          <button key={tab} className={`px-3 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>{tab}</button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">解析ケース一覧</h2></CardHeader>
            <CardBody className="space-y-2">
              {analysisCases.map((item) => (
                <button key={item.id} onClick={() => caseSelection.select(item.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${item.id === caseSelection.selectedId ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                  <span>{item.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.method} / {item.alphaSweep}</span>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">解析設定</h2></CardHeader>
            <CardBody className="space-y-3">
              <Setting label="解析手法" value={selected.method} />
              <Setting label="α sweep" value={selected.alphaSweep} />
              <Setting label="速度" value={`${selected.speed} m/s`} />
              <Setting label="高度" value={`${selected.altitude} m`} />
              <Setting label="Re" value={selected.reynolds.toLocaleString()} />
              <Setting label="使用ジオメトリ" value={selected.geometry} />
              <Button className="w-full" variant={hasRun ? "success" : "primary"} onClick={() => setHasRun(true)}>
                <Zap size={16} />
                解析を実行
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard label="CLmax" value={hasRun ? analysisResult.clMax.toString() : "-"} />
            <MetricCard label="CDmin" value={hasRun ? analysisResult.cdMin.toString() : "-"} />
            <MetricCard label="最大 L/D" value={hasRun ? analysisResult.maxLD.toString() : "-"} />
            <MetricCard label="Cm0" value={hasRun ? analysisResult.cm0.toString() : "-"} />
            <MetricCard label="実行ステータス" value={hasRun ? "完了" : "未実行"} />
          </div>

          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">結果グラフ</h2></CardHeader>
            <CardBody>
              <PolarCharts data={chartData} mode="analysis" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">結果一覧</h2></CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>{["Case", "α", "CL", "CD", "Cm", "L/D", "Status"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysisResult.rows.slice(0, 10).map((row) => (
                      <tr key={`${row.caseName}-${row.alpha}`}>
                        <td className="px-2 py-3 font-medium">{row.caseName}</td>
                        <td className="px-2 py-3">{row.alpha}°</td>
                        <td className="px-2 py-3">{row.cl}</td>
                        <td className="px-2 py-3">{row.cd}</td>
                        <td className="px-2 py-3">{row.cm}</td>
                        <td className="px-2 py-3">{row.ld}</td>
                        <td className="px-2 py-3"><Badge tone="green">{row.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-950">揚力分布ビュー</h2>
              <Badge tone={hasRun ? "green" : "slate"}>{hasRun ? "表示中" : "未実行"}</Badge>
            </CardHeader>
            <CardBody>
              <AircraftPreview lift={hasRun} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-slate-950">エクスポート</h2></CardHeader>
            <CardBody className="grid gap-2">
              <Button variant="secondary"><Download size={16} />CSV出力</Button>
              <Button variant="secondary"><Download size={16} />JSON出力</Button>
              <Button variant="secondary"><Save size={16} />結果を保存</Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <Badge tone="blue">MVP2</Badge>
              <p className="font-semibold text-slate-950">トリム解析はMVP2で対応</p>
              <p className="text-sm leading-6 text-slate-500">次は重心・尾翼効き・安定微係数を追加し、設計評価を拡張します。</p>
            </CardBody>
          </Card>

          <Button className="w-full" variant="secondary" onClick={() => navigate("/aircraft")}>
            <RotateCcw size={16} />
            設計へ戻る
          </Button>
        </div>
      </div>
    </div>
  );
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
