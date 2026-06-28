import type { AirfoilPolar } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilAnalysisCaseTableProps {
  cases: AirfoilPolar[];
}

export function AirfoilAnalysisCaseTable({ cases }: AirfoilAnalysisCaseTableProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-slate-950">解析ケース一覧</h2>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>{["ケース名", "Re数", "Mach数", "α範囲", "収束状況", "ステータス"].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}</tr>
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
        </div>
      </CardBody>
    </Card>
  );
}
