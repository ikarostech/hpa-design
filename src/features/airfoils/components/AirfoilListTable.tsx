import { Info, Pencil } from "lucide-react";
import type { Airfoil, AirfoilPolar } from "../model/types";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { AirfoilTargetTable } from "./AirfoilTargetTable";

interface AirfoilListTableProps {
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  selectedId: string;
  detailOpen: boolean;
  selectedForAnalysisIds: string[];
  onOpenDetail: (airfoilId: string) => void;
  onEdit: (airfoilId: string) => void;
  onToggleAnalysisTarget: (airfoilId: string) => void;
}

export function AirfoilListTable({
  airfoils,
  airfoilPolars,
  selectedId,
  detailOpen,
  selectedForAnalysisIds,
  onOpenDetail,
  onEdit,
  onToggleAnalysisTarget,
}: AirfoilListTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">翼型リスト</h2>
          <p className="mt-1 text-sm text-slate-500">チェックした翼型を2D翼型解析で一括実行します。詳細を開くと右側のサイドバーで形状を確認できます。</p>
        </div>
      </CardHeader>
      <CardBody>
        <AirfoilTargetTable
          airfoils={airfoils}
          airfoilPolars={airfoilPolars}
          selectedId={selectedId}
          selectedForAnalysisIds={selectedForAnalysisIds}
          onToggleAnalysisTarget={onToggleAnalysisTarget}
          actions={(airfoil, { isSelected }) => (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => onEdit(airfoil.id)}>
                <Pencil size={14} />
                編集
              </Button>
              <Button variant={isSelected && detailOpen ? "primary" : "secondary"} size="sm" onClick={() => onOpenDetail(airfoil.id)}>
                <Info size={14} />
                詳細
              </Button>
            </div>
          )}
        />
      </CardBody>
    </Card>
  );
}
