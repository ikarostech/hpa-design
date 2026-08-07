import { FileUp, Pencil } from "lucide-react";
import type { InspectorController } from "@/shared/model";
import type { Airfoil } from "../model/types";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { InspectorDrawer } from "../../../shared/ui/inspector/InspectorDrawer";
import { AirfoilPlot } from "./AirfoilPlot";
import { AirfoilShapeMetricsPanel } from "./AirfoilShapeMetricsPanel";

interface AirfoilDetailDrawerProps {
  airfoil: Airfoil;
  inspector: InspectorController<string>;
  polarReady: boolean;
  onEdit: () => void;
  onReapplyCoordinates: () => void;
}

export function AirfoilDetailDrawer({ airfoil, inspector, polarReady, onEdit, onReapplyCoordinates }: AirfoilDetailDrawerProps) {
  if (!inspector.state.open) {
    return null;
  }

  return (
    <InspectorDrawer
      open={inspector.state.open}
      title={airfoil.name}
      subtitle="翼型形状と基本パラメータ"
      closeLabel="詳細を閉じる"
      backLabel="一覧に戻る"
      onClose={inspector.close}
      headerActions={<>
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil size={14} />
              編集
            </Button>
            <Button variant="secondary" size="sm" onClick={onReapplyCoordinates}>
              <FileUp size={14} />
              座標を更新
            </Button>
      </>}
    >
        <div className="space-y-5">
          <AirfoilPlot airfoil={airfoil} className="h-48 min-h-0" />
          <AirfoilShapeMetricsPanel airfoil={airfoil} />
          {polarReady ? <Badge tone="green">Polar作成済み</Badge> : <Badge tone="amber">未作成</Badge>}
        </div>
    </InspectorDrawer>
  );
}
