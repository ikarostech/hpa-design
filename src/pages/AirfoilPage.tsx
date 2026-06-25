import { CheckCircle2, FileUp, Plus, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { AirfoilPlot } from "../features/airfoils/components/AirfoilPlot";
import { PolarCharts } from "../features/airfoils/components/PolarCharts";
import { airfoilPolars, airfoils, polarPoints } from "../mocks/mockData";
import { Badge } from "../shared/ui/Badge";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";

export function AirfoilPage() {
  const [selectedId, setSelectedId] = useState(airfoils[0].id);
  const [polarReady, setPolarReady] = useState(true);
  const selected = airfoils.find((airfoil) => airfoil.id === selectedId) ?? airfoils[0];
  const cases = useMemo(() => (polarReady ? airfoilPolars : airfoilPolars.filter((polar) => polar.airfoilId !== selected.id)), [polarReady, selected.id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">翼型ライブラリ</h1>
        <p className="mt-1 text-sm text-slate-500">翼型の選択、簡易2D解析設定、Polar確認を行います。</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[260px_1fr_360px]">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-950">翼型リスト</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {airfoils.map((airfoil) => (
              <button
                key={airfoil.id}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${selected.id === airfoil.id ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
                onClick={() => setSelectedId(airfoil.id)}
              >
                {airfoil.name}
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-3">
              <Button variant="secondary"><Plus size={15} />NACA生成</Button>
              <Button variant="secondary"><FileUp size={15} />.dat</Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-950">{selected.name}</h2>
              {polarReady ? <Badge tone="green">Polar作成済み</Badge> : <Badge tone="amber">未作成</Badge>}
            </CardHeader>
            <CardBody>
              <AirfoilPlot airfoil={selected} />
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <DataBox label="厚み比" value={`${selected.thicknessRatio}%`} />
                <DataBox label="最大キャンバー" value={`${selected.maxCamber}%`} />
                <DataBox label="LE半径" value={`${selected.leadingEdgeRadius}%`} />
                <DataBox label="TE厚" value={`${selected.trailingEdgeThickness}%`} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-950">解析ケース一覧</h2>
            </CardHeader>
            <CardBody>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>{["ケース名", "Re数", "Mach数", "α範囲", "収束状況", "ステータス"].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cases.map((polar) => (
                    <tr key={polar.id}>
                      <td className="px-2 py-3 font-medium">{polar.caseName}</td>
                      <td className="px-2 py-3">{polar.reynolds.toLocaleString()}</td>
                      <td className="px-2 py-3">{polar.mach}</td>
                      <td className="px-2 py-3">{polar.alphaRange}</td>
                      <td className="px-2 py-3">{polar.converged}</td>
                      <td className="px-2 py-3"><Badge tone={polar.status === "完了" ? "green" : "amber"}>{polar.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-950">2D解析設定</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <Input label="Re数" value="300000" />
              <Input label="Mach数" value="0.04" />
              <Input label="α範囲" value="-6° to 18°" />
              <Input label="Ncrit" value="9" />
              <Input label="遷移モデル" value="eN簡易モデル" />
              <Button className="w-full" variant={polarReady ? "success" : "primary"} onClick={() => setPolarReady(true)}>
                <CheckCircle2 size={16} />
                Polarを作成
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-950">解析グラフ</h2>
            </CardHeader>
            <CardBody>
              <PolarCharts data={polarPoints} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-950">次の推奨ステップ</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {["主翼に割り当てる", "解析ケースを追加", "翼型を比較"].map((step) => (
                <button key={step} className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-blue-50">
                  {step}<Send size={14} className="text-blue-600" />
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>;
}

function Input({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" defaultValue={value} /></label>;
}
