import { FileUp, Plus } from "lucide-react";
import { AirfoilAnalysisCaseTable } from "../features/airfoils/components/AirfoilAnalysisCaseTable";
import { AirfoilAnalysisDrawer } from "../features/airfoils/components/AirfoilAnalysisDrawer";
import { AirfoilChartPanel } from "../features/airfoils/components/AirfoilChartPanel";
import { AirfoilDetailDrawer } from "../features/airfoils/components/AirfoilDetailDrawer";
import { AirfoilEditorDrawer } from "../features/airfoils/components/AirfoilEditorDrawer";
import { AirfoilListTable } from "../features/airfoils/components/AirfoilListTable";
import { AirfoilNextStepsCard } from "../features/airfoils/components/AirfoilNextStepsCard";
import { useAirfoilWorkspace } from "../features/airfoils/hooks/useAirfoilWorkspace";
import { Button } from "../shared/ui/Button";

export function AirfoilPage() {
  const workspace = useAirfoilWorkspace();
  const { detailInspector, analysisTargets, displayedRuns } = workspace.selection;

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
          airfoils={workspace.airfoils}
          airfoilPolars={workspace.polars}
          detailInspector={detailInspector}
          analysisTargets={analysisTargets}
          onEdit={(airfoilId) => workspace.openEditor("edit", airfoilId)}
        />
        <AirfoilAnalysisCaseTable
          runs={workspace.analysisRuns}
          airfoils={workspace.airfoils}
          displayedRuns={displayedRuns}
          onCreateRun={workspace.openAnalysisDrawer}
        />
        <AirfoilNextStepsCard />
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
        airfoils={workspace.airfoils}
        airfoilPolars={workspace.polars}
        analysisTargets={analysisTargets}
        targetNames={workspace.selectedTargetNames}
        jobController={workspace.analysisJobController}
        onClose={workspace.closeAnalysisDrawer}
      />
    </div>
  );
}
