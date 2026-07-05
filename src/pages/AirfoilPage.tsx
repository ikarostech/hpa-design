import { useMemo, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { AirfoilAnalysisCaseTable } from "../features/airfoils/components/AirfoilAnalysisCaseTable";
import { AirfoilAnalysisDrawer } from "../features/airfoils/components/AirfoilAnalysisDrawer";
import { AirfoilChartPanel } from "../features/airfoils/components/AirfoilChartPanel";
import { AirfoilDetailDrawer } from "../features/airfoils/components/AirfoilDetailDrawer";
import { AirfoilEditorDrawer, type AirfoilEditorMode } from "../features/airfoils/components/AirfoilEditorDrawer";
import { AirfoilListTable } from "../features/airfoils/components/AirfoilListTable";
import { AirfoilNextStepsCard } from "../features/airfoils/components/AirfoilNextStepsCard";
import { buildAirfoilChartSeries } from "../features/airfoils/model/chartSeries";
import type { Airfoil, AirfoilAnalysisRun, AirfoilPolar } from "../features/airfoils/model/types";
import { runXfoilAnalysis, type XfoilAnalysisSettings } from "../features/airfoils/model/xfoilAnalysis";
import { airfoilPolars, airfoils, polarPoints } from "../mocks/mockData";
import { Button } from "../shared/ui/Button";

const initialAnalysisRuns: AirfoilAnalysisRun[] = [
  {
    id: "run-initial-polars",
    name: "初期Polar比較",
    airfoilIds: Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))),
    polarIds: airfoilPolars.map((polar) => polar.id),
    createdAt: "サンプルデータ",
    reynolds: 300000,
    mach: 0.04,
    alphaRange: "-6° to 18°",
    status: "完了",
  },
];

export function AirfoilPage() {
  const [airfoilItems, setAirfoilItems] = useState<Airfoil[]>(airfoils);
  const [selectedId, setSelectedId] = useState(airfoils[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<AirfoilEditorMode | null>(null);
  const [analysisDrawerOpen, setAnalysisDrawerOpen] = useState(false);
  const [generatedPolars, setGeneratedPolars] = useState<typeof airfoilPolars>([]);
  const [analysisRuns, setAnalysisRuns] = useState<AirfoilAnalysisRun[]>(initialAnalysisRuns);
  const [selectedRunId, setSelectedRunId] = useState(initialAnalysisRuns[0].id);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedForAnalysisIds, setSelectedForAnalysisIds] = useState<string[]>(() => [airfoils[0].id, airfoils[1].id]);

  const allPolars = useMemo(() => [...airfoilPolars, ...generatedPolars], [generatedPolars]);
  const selected = airfoilItems.find((airfoil) => airfoil.id === selectedId) ?? airfoilItems[0];
  const selectedRun = analysisRuns.find((run) => run.id === selectedRunId) ?? analysisRuns[0];
  const selectedRunPolars = useMemo(() => allPolars.filter((polar) => selectedRun.polarIds.includes(polar.id)), [allPolars, selectedRun.polarIds]);
  const selectedTargetNames = useMemo(() => selectedForAnalysisIds
    .map((id) => airfoilItems.find((airfoil) => airfoil.id === id)?.name)
    .filter((name): name is string => Boolean(name)), [airfoilItems, selectedForAnalysisIds]);
  const selectedHasPolar = allPolars.some((polar) => polar.airfoilId === selected.id);
  const chartSeries = useMemo(() => buildAirfoilChartSeries(selectedRunPolars, airfoilItems), [airfoilItems, selectedRunPolars]);

  const openDetail = (airfoilId: string) => {
    setSelectedId(airfoilId);
    setDetailOpen(true);
  };

  const openEditor = (mode: AirfoilEditorMode, airfoilId?: string) => {
    if (airfoilId) {
      setSelectedId(airfoilId);
    }
    setDetailOpen(false);
    setEditorMode(mode);
  };

  const toggleAnalysisTarget = (airfoilId: string) => {
    setSelectedForAnalysisIds((current) => current.includes(airfoilId)
      ? current.filter((id) => id !== airfoilId)
      : [...current, airfoilId]);
  };

  const saveAirfoil = (airfoil: Airfoil) => {
    setAirfoilItems((current) => {
      const exists = current.some((item) => item.id === airfoil.id);
      return exists ? current.map((item) => item.id === airfoil.id ? airfoil : item) : [airfoil, ...current];
    });
    setSelectedId(airfoil.id);
    setEditorMode(null);
  };

  const runAnalysis = async (settings: XfoilAnalysisSettings) => {
    setAnalysisRunning(true);
    setAnalysisError(null);

    try {
      const targets = airfoilItems.filter((airfoil) => selectedForAnalysisIds.includes(airfoil.id));
      const polars: AirfoilPolar[] = [];

      for (const airfoil of targets) {
        polars.push(await runXfoilAnalysis(airfoil, settings));
      }

      const runId = `run-${Date.now()}`;
      const run: AirfoilAnalysisRun = {
        id: runId,
        name: `一括解析 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`,
        airfoilIds: targets.map((airfoil) => airfoil.id),
        polarIds: polars.map((polar) => polar.id),
        createdAt: new Date().toLocaleString("ja-JP"),
        reynolds: settings.reynolds,
        mach: settings.mach,
        alphaRange: `${settings.alphaStart}° to ${settings.alphaEnd}°`,
        status: "完了",
      };

      setGeneratedPolars((current) => [...polars, ...current]);
      setAnalysisRuns((current) => [run, ...current]);
      setSelectedRunId(runId);
      setAnalysisDrawerOpen(false);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "XFOIL解析に失敗しました。");
    } finally {
      setAnalysisRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">翼型ライブラリ</h1>
          <p className="mt-1 text-sm text-slate-500">翼型の比較、Polar設定、解析結果を確認します。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openEditor("create-naca")}>
            <Plus size={16} />
            NACA生成
          </Button>
          <Button variant="secondary" onClick={() => openEditor("import-dat")}>
            <FileUp size={16} />
            .dat
          </Button>
        </div>
      </div>

      <AirfoilChartPanel data={polarPoints} series={chartSeries} />

      <div className="space-y-5">
        <AirfoilListTable
          airfoils={airfoilItems}
          airfoilPolars={allPolars}
          selectedId={selected.id}
          detailOpen={detailOpen}
          selectedForAnalysisIds={selectedForAnalysisIds}
          onOpenDetail={openDetail}
          onEdit={(airfoilId) => openEditor("edit", airfoilId)}
          onToggleAnalysisTarget={toggleAnalysisTarget}
        />
        <AirfoilAnalysisCaseTable
          runs={analysisRuns}
          airfoils={airfoilItems}
          selectedRunId={selectedRun.id}
          onCreateRun={() => setAnalysisDrawerOpen(true)}
          onSelectRun={setSelectedRunId}
        />
        <AirfoilNextStepsCard />
      </div>

      <AirfoilDetailDrawer
        airfoil={selected}
        open={detailOpen}
        polarReady={selectedHasPolar}
        onEdit={() => openEditor("edit", selected.id)}
        onClose={() => setDetailOpen(false)}
      />
      <AirfoilEditorDrawer
        mode={editorMode}
        airfoil={selected}
        open={editorMode !== null}
        onClose={() => setEditorMode(null)}
        onSave={saveAirfoil}
      />
      <AirfoilAnalysisDrawer
        open={analysisDrawerOpen}
        airfoils={airfoilItems}
        airfoilPolars={allPolars}
        selectedForAnalysisIds={selectedForAnalysisIds}
        targetNames={selectedTargetNames}
        isRunning={analysisRunning}
        error={analysisError}
        onClose={() => setAnalysisDrawerOpen(false)}
        onToggleAnalysisTarget={toggleAnalysisTarget}
        onRun={runAnalysis}
      />
    </div>
  );
}
