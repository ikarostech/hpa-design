import { FileUp, Info, Pencil, Plus, Trash2 } from "lucide-react";
import type { InspectorController, MultiSelection } from "@/shared/model";
import type { Airfoil, AirfoilPolar } from "../model/types";
import { Button } from "../../../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../../../shared/ui/Card";
import { AirfoilTargetTable } from "./AirfoilTargetTable";

interface AirfoilListTableProps {
  airfoils: Airfoil[];
  airfoilPolars: AirfoilPolar[];
  detailInspector: InspectorController<string>;
  analysisTargets: MultiSelection<string>;
  onCreateNaca: () => void;
  onImportDat: () => void;
  onEdit: (airfoilId: string) => void;
  onRemove: (airfoilId: string) => void;
}

export function AirfoilListTable({
  airfoils,
  airfoilPolars,
  detailInspector,
  analysisTargets,
  onCreateNaca,
  onImportDat,
  onEdit,
  onRemove,
}: AirfoilListTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">翼型リスト</h2>
          <p className="mt-1 text-sm text-slate-500">チェックした翼型を2D翼型解析で一括実行します。詳細を開くと右側のサイドバーで形状を確認できます。</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onCreateNaca}><Plus size={15} />NACA生成</Button>
          <Button size="sm" variant="secondary" onClick={onImportDat}><FileUp size={15} />.datを読み込む</Button>
        </div>
      </CardHeader>
      <CardBody>
        {airfoils.length ? <AirfoilTargetTable
          airfoils={airfoils}
          airfoilPolars={airfoilPolars}
          selectedId={detailInspector.state.targetId ?? undefined}
          analysisTargets={analysisTargets}
          actions={(airfoil, { isSelected }) => (
            <div className="flex justify-end gap-1">
              <Button variant={isSelected && detailInspector.state.open ? "primary" : "ghost"} size="icon" aria-label={`${airfoil.name}を詳細表示`} title="詳細" onClick={() => detailInspector.openDetail(airfoil.id)}><Info size={15} /></Button>
              <Button variant="ghost" size="icon" aria-label={`${airfoil.name}を編集`} title="編集" onClick={() => onEdit(airfoil.id)}><Pencil size={15} /></Button>
              <Button variant="destructive" size="icon" aria-label={`${airfoil.name}を削除`} title="削除" onClick={() => onRemove(airfoil.id)}><Trash2 size={15} /></Button>
            </div>
          )}
        /> : <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">翼型がありません。NACA 生成または .dat 取込で翼型を追加してください。</div>}
      </CardBody>
    </Card>
  );
}
