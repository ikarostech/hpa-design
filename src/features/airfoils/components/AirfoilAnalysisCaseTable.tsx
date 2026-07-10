import { Play } from "lucide-react";
import type { ResultViewController } from "@/shared/model";
import type { Airfoil, AirfoilAnalysisRun } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilAnalysisCaseTableProps {
  runs: AirfoilAnalysisRun[];
  airfoils: Airfoil[];
  displayedRuns: ResultViewController<string>;
  onCreateRun: () => void;
}

export function AirfoilAnalysisCaseTable({ runs, airfoils, displayedRuns, onCreateRun }: AirfoilAnalysisCaseTableProps) {
  const selectedRunId = displayedRuns.state.primaryResultId;
  const getAirfoilNames = (airfoilIds: string[]) => airfoilIds
    .map((id) => airfoils.find((airfoil) => airfoil.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">解析リスト</h2>
          <p className="mt-1 text-sm text-slate-500">選択した解析だけを上部グラフに表示します。新規解析はサイドパネルで作成します。</p>
        </div>
        <Button variant="secondary" onClick={onCreateRun}>
          <Play size={15} />
          解析を作成
        </Button>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>{["表示", "解析名", "対象翼型", "Re数", "Mach数", "α範囲", "ステータス"].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={selectedRunId === run.id ? "bg-blue-50/60" : "cursor-pointer hover:bg-slate-50"}
                  onClick={() => displayedRuns.setPrimary(run.id)}
                >
                  <td className="px-2 py-3">
                    <input
                      type="radio"
                      className="h-4 w-4 border-slate-300 text-blue-600"
                      checked={selectedRunId === run.id}
                      aria-label={`${run.name}をグラフに表示`}
                      onChange={() => displayedRuns.setPrimary(run.id)}
                    />
                  </td>
                  <td className="px-2 py-3 font-medium text-slate-950">
                    <div>{run.name}</div>
                    <div className="mt-1 text-xs font-normal text-slate-500">{run.createdAt}</div>
                  </td>
                  <td className="px-2 py-3">{getAirfoilNames(run.airfoilIds)}</td>
                  <td className="px-2 py-3">{run.reynolds.toLocaleString()}</td>
                  <td className="px-2 py-3">{run.mach}</td>
                  <td className="px-2 py-3">{run.alphaRange}</td>
                  <td className="px-2 py-3"><Badge tone={run.status === "完了" ? "green" : "amber"}>{run.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
