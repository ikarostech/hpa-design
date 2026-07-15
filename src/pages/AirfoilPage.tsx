import { FileUp, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirfoilAnalysisCaseTable } from "../features/airfoils/components/AirfoilAnalysisCaseTable";
import { AirfoilAnalysisDrawer } from "../features/airfoils/components/AirfoilAnalysisDrawer";
import { AirfoilChartPanel } from "../features/airfoils/components/AirfoilChartPanel";
import { AirfoilDetailDrawer } from "../features/airfoils/components/AirfoilDetailDrawer";
import { AirfoilEditorDrawer } from "../features/airfoils/components/AirfoilEditorDrawer";
import { AirfoilListTable } from "../features/airfoils/components/AirfoilListTable";
import { AirfoilNextStepsCard } from "../features/airfoils/components/AirfoilNextStepsCard";
import { useAirfoilWorkspace } from "../features/airfoils/hooks/useAirfoilWorkspace";
import type { AirfoilWorkspaceData } from "../features/airfoils/model/workspace";
import { Button } from "../shared/ui/Button";
import { Card, CardBody, CardHeader } from "../shared/ui/Card";

export function AirfoilPage({ data }: { data: AirfoilWorkspaceData }) {
  const workspace = useAirfoilWorkspace(data);
  const navigate = useNavigate();
  const { detailInspector, analysisTargets, displayedRuns } = workspace.selection;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingAirfoil = workspace.airfoils.find((airfoil) => airfoil.id === pendingDeleteId);
  const pendingReferences = pendingAirfoil ? workspace.referencesForAirfoil(pendingAirfoil.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">翼型ライブラリ</h1>
          <p className="mt-1 text-sm text-slate-500">翼型の比較、Polar設定、解析結果を確認します。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => workspace.openEditor("create-naca")}>
            <Plus size={16} />
            NACA生成
          </Button>
          <Button variant="secondary" onClick={() => workspace.openEditor("import-dat")}>
            <FileUp size={16} />
            .dat
          </Button>
        </div>
      </div>

      <AirfoilChartPanel data={workspace.polarPoints} series={workspace.chartSeries} />

      <div className="space-y-5">
        <AirfoilListTable
          airfoils={[...workspace.airfoils]}
          airfoilPolars={[...workspace.polars]}
          detailInspector={detailInspector}
          analysisTargets={analysisTargets}
          onEdit={(airfoilId) => workspace.openEditor("edit", airfoilId)}
          onRemove={setPendingDeleteId}
        />
        <AirfoilAnalysisCaseTable
          runs={[...workspace.analysisRuns]}
          airfoils={[...workspace.airfoils]}
          displayedRuns={displayedRuns}
          onCreateRun={workspace.openAnalysisDrawer}
        />
        <AirfoilNextStepsCard onAssignToWing={() => navigate("/aircraft")} onAddAnalysisCase={() => navigate("/analysis")} onCompareAirfoils={workspace.compareAllRuns} />
      </div>

      <AirfoilDetailDrawer
        airfoil={workspace.selected}
        inspector={detailInspector}
        polarReady={workspace.selectedHasPolar}
        onEdit={() => workspace.openEditor("edit", workspace.selected.id)}
      />
      <AirfoilEditorDrawer
        mode={workspace.editorMode}
        airfoil={workspace.selected}
        open={workspace.editorMode !== null}
        onClose={workspace.closeEditor}
        onSave={workspace.saveAirfoil}
      />
      <AirfoilAnalysisDrawer
        open={workspace.analysisDrawerState.open}
        airfoils={[...workspace.airfoils]}
        airfoilPolars={[...workspace.polars]}
        analysisTargets={analysisTargets}
        targetNames={workspace.selectedTargetNames}
        jobController={workspace.analysisJobController}
        onClose={workspace.closeAnalysisDrawer}
      />
      {pendingAirfoil ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><Card className="w-full max-w-md"><CardHeader><h2 className="font-semibold text-slate-950">{pendingAirfoil.name} を削除しますか？</h2></CardHeader><CardBody className="space-y-4">{pendingReferences.length ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><p className="font-medium">この翼型は次から参照されています。削除できません。</p><ul className="mt-2 list-disc pl-5">{pendingReferences.map((reference) => <li key={reference}>{reference}</li>)}</ul></div> : <p className="text-sm text-slate-600">参照元はありません。この操作は元に戻せません。</p>}{workspace.removalError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{workspace.removalError}</p> : null}<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => { workspace.clearRemovalError(); setPendingDeleteId(null); }}>キャンセル</Button>{!pendingReferences.length ? <Button variant="destructive" onClick={() => void workspace.removeAirfoil(pendingAirfoil.id).then((removed) => { if (removed) setPendingDeleteId(null); })}>削除する</Button> : null}</div></CardBody></Card></div> : null}
    </div>
  );
}
