import { FileUp, Info, Plus } from "lucide-react";
import type { Airfoil, AirfoilPolar } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";

interface AirfoilListTableProps {
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  selectedId: string;
  detailOpen: boolean;
  visibleAirfoilIds: string[];
  onOpenDetail: (airfoilId: string) => void;
  onToggleChartLine: (airfoilId: string) => void;
}

export function AirfoilListTable({
  airfoils,
  airfoilPolars,
  selectedId,
  detailOpen,
  visibleAirfoilIds,
  onOpenDetail,
  onToggleChartLine,
}: AirfoilListTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">翼型リスト</h2>
          <p className="mt-1 text-sm text-slate-500">チェックを切り替えると、上部グラフの表示線を変更できます。詳細を開くと右側のサイドバーで形状を確認できます。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary"><Plus size={15} />NACA生成</Button>
          <Button variant="secondary"><FileUp size={15} />.dat</Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {["表示", "翼型", "厚み比", "最大キャンバー", "LE半径", "TE厚", "状態", ""].map((heading) => <th key={heading} className="px-2 py-2">{heading}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {airfoils.map((airfoil) => {
                const isSelected = selectedId === airfoil.id;
                const hasPolar = airfoilPolars.some((polar) => polar.airfoilId === airfoil.id);
                const isVisible = visibleAirfoilIds.includes(airfoil.id);

                return (
                  <tr key={airfoil.id} className={isSelected ? "bg-blue-50/60" : undefined}>
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-40"
                        checked={isVisible}
                        disabled={!hasPolar}
                        aria-label={`${airfoil.name}のグラフ表示を切り替え`}
                        onChange={() => onToggleChartLine(airfoil.id)}
                      />
                    </td>
                    <td className="px-2 py-3 font-semibold text-slate-950">{airfoil.name}</td>
                    <td className="px-2 py-3">{airfoil.thicknessRatio}%</td>
                    <td className="px-2 py-3">{airfoil.maxCamber}%</td>
                    <td className="px-2 py-3">{airfoil.leadingEdgeRadius}%</td>
                    <td className="px-2 py-3">{airfoil.trailingEdgeThickness}%</td>
                    <td className="px-2 py-3">
                      {hasPolar ? <Badge tone="green">Polarあり</Badge> : <Badge tone="amber">未解析</Badge>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <Button variant={isSelected && detailOpen ? "primary" : "secondary"} size="sm" onClick={() => onOpenDetail(airfoil.id)}>
                        <Info size={14} />
                        詳細
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
