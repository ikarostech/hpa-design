import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirfoilAnalysisCaseTable } from "../features/airfoils/components/AirfoilAnalysisCaseTable";
import { AirfoilAnalysisDrawer } from "../features/airfoils/components/AirfoilAnalysisDrawer";
import { AirfoilAnalysisRunDrawer } from "../features/airfoils/components/AirfoilAnalysisRunDrawer";
import { AirfoilChartPanel } from "../features/airfoils/components/AirfoilChartPanel";
import { AirfoilDetailDrawer } from "../features/airfoils/components/AirfoilDetailDrawer";
import { AirfoilEditorDrawer } from "../features/airfoils/components/AirfoilEditorDrawer";
import { AirfoilListTable } from "../features/airfoils/components/AirfoilListTable";
import { AirfoilNextStepsCard } from "../features/airfoils/components/AirfoilNextStepsCard";
import { airfoilAnalysisExporter } from "../features/airfoils/services/airfoilAnalysisExporter";
import { useAirfoilWorkspace } from "../features/airfoils/hooks/useAirfoilWorkspace";
import type { AirfoilWorkspaceData } from "../features/airfoils/model/workspace";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

export function AirfoilPage({ data }: { data: AirfoilWorkspaceData }) {
  const workspace = useAirfoilWorkspace(data);
  const navigate = useNavigate();
  const { detailInspector, analysisTargets, displayedRuns } = workspace.selection;
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);
  const [nextStepError, setNextStepError] = useState<string | null>(null);
  const pendingAirfoil = workspace.airfoils.find((airfoil) => airfoil.id === pendingDeleteId);
  const pendingReferences = pendingAirfoil ? workspace.referencesForAirfoil(pendingAirfoil.id) : [];

  return (
    <PageTemplate title="翼型ライブラリ" description="翼型の比較、Polar設定、解析結果を確認します。">

      <AirfoilChartPanel data={workspace.polarPoints} series={workspace.chartSeries} />

      <div className="space-y-5">
        <AirfoilListTable
          airfoils={[...workspace.airfoils]}
          airfoilPolars={[...workspace.polars]}
          detailInspector={detailInspector}
          analysisTargets={analysisTargets}
          onCreateNaca={() => workspace.openEditor("create-naca")}
          onImportDat={() => workspace.openEditor("import-dat")}
          onEdit={(airfoilId) => workspace.openEditor("edit", airfoilId)}
          onRemove={setPendingDeleteId}
        />
        <AirfoilAnalysisCaseTable
          runs={[...workspace.analysisRuns]}
          airfoils={[...workspace.airfoils]}
          displayedRuns={displayedRuns}
          comparisonLimitReached={workspace.comparisonLimitReached}
          maxComparisonRuns={workspace.maxComparisonRuns}
          onCreateRun={workspace.openAnalysisDrawer}
          onOpenDetail={(run) => setDetailRunId(run.id)}
          onRetryRun={workspace.retryFailedRun}
          onDuplicateRun={workspace.duplicateAnalysisRun}
          onRenameRun={workspace.renameAnalysisRun}
          onDeleteRun={(run) => setPendingRunId(run.id)}
          onExportRun={(run, format) => void exportRun(data.designName, run, workspace.polars, format)}
        />
        <AirfoilNextStepsCard onAssignToWing={() => workspace.selected ? navigate(`/aircraft?airfoilId=${encodeURIComponent(workspace.selected.id)}`) : setNextStepError("翼型を選択してください。")} onAddAnalysisCase={() => workspace.polars.length ? navigate("/analysis") : setNextStepError("先に少なくとも1件のPolar解析を完了してください。")} onCompareAirfoils={workspace.compareAllRuns} />
        {nextStepError ? <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{nextStepError}</p> : null}
      </div>

      <AirfoilDetailDrawer
        airfoil={workspace.selected}
        inspector={detailInspector}
        polarReady={workspace.selectedHasPolar}
        onEdit={() => workspace.openEditor("edit", workspace.selected.id)}
        onReapplyCoordinates={() => workspace.openEditor("reapply-dat", workspace.selected.id)}
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
        defaultReynolds={data.defaultReynolds}
        initialSettings={workspace.drawerSettings}
        onClose={workspace.closeAnalysisDrawer}
      />
      <AirfoilAnalysisRunDrawer open={detailRunId !== null} run={workspace.analysisRuns.find((run) => run.id === detailRunId) ?? null} airfoils={workspace.airfoils} onClose={() => setDetailRunId(null)} />
      <DeleteConfirmationDialog
        open={pendingAirfoil !== undefined}
        title={pendingAirfoil ? `${pendingAirfoil.name} を削除しますか？` : "翼型を削除しますか？"}
        description="参照元はありません。この操作は元に戻せません。"
        blockedReason={pendingReferences.length ? <><p className="font-medium">この翼型は次から参照されています。削除できません。</p><ul className="mt-2 list-disc pl-5">{pendingReferences.map((reference) => <li key={reference}>{reference}</li>)}</ul></> : undefined}
        error={workspace.removalError ?? undefined}
        onCancel={() => { workspace.clearRemovalError(); setPendingDeleteId(null); }}
        onConfirm={() => {
          if (!pendingAirfoil) return;
          void workspace.removeAirfoil(pendingAirfoil.id).then((removed) => { if (removed) setPendingDeleteId(null); });
        }}
      />
      <DeleteConfirmationDialog
        open={pendingRunId !== null}
        title="解析 run を削除しますか？"
        description="この run だけが参照する Polar も削除されます。解析結果が参照する Polar は保持されます。"
        onCancel={() => setPendingRunId(null)}
        onConfirm={() => { if (pendingRunId) { workspace.removeAnalysisRun(pendingRunId); setPendingRunId(null); } }}
      />
    </PageTemplate>
  );
}

async function exportRun(designName: string, run: Parameters<typeof airfoilAnalysisExporter.export>[0]["run"], polars: readonly import("../features/airfoils/model/types").AirfoilPolar[], format: "csv" | "json") {
  const file = format === "csv" ? await airfoilAnalysisExporter.export({ designName, run, polars }) : await airfoilAnalysisExporter.exportJson({ designName, run, polars });
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}
