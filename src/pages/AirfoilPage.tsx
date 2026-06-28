import { useMemo, useState } from "react";
import { AirfoilAnalysisCaseTable } from "../features/airfoils/components/AirfoilAnalysisCaseTable";
import { AirfoilAnalysisSettingsCard } from "../features/airfoils/components/AirfoilAnalysisSettingsCard";
import { AirfoilChartPanel } from "../features/airfoils/components/AirfoilChartPanel";
import { AirfoilDetailDrawer } from "../features/airfoils/components/AirfoilDetailDrawer";
import { AirfoilListTable } from "../features/airfoils/components/AirfoilListTable";
import { AirfoilNextStepsCard } from "../features/airfoils/components/AirfoilNextStepsCard";
import { buildAirfoilChartSeries } from "../features/airfoils/model/chartSeries";
import { airfoilPolars, airfoils, polarPoints } from "../mocks/mockData";

export function AirfoilPage() {
  const [selectedId, setSelectedId] = useState(airfoils[0].id);
  const [polarReady, setPolarReady] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [visibleAirfoilIds, setVisibleAirfoilIds] = useState(() => Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))));

  const selected = airfoils.find((airfoil) => airfoil.id === selectedId) ?? airfoils[0];
  const cases = useMemo(() => (polarReady ? airfoilPolars : airfoilPolars.filter((polar) => polar.airfoilId !== selected.id)), [polarReady, selected.id]);
  const chartSeries = useMemo(() => buildAirfoilChartSeries(cases, airfoils, visibleAirfoilIds), [cases, visibleAirfoilIds]);

  const openDetail = (airfoilId: string) => {
    setSelectedId(airfoilId);
    setDetailOpen(true);
  };

  const toggleChartLine = (airfoilId: string) => {
    setVisibleAirfoilIds((current) => current.includes(airfoilId)
      ? current.filter((id) => id !== airfoilId)
      : [...current, airfoilId]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">翼型ライブラリ</h1>
        <p className="mt-1 text-sm text-slate-500">翼型の比較、Polar設定、解析結果を確認します。</p>
      </div>

      <AirfoilChartPanel data={polarPoints} series={chartSeries} />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <AirfoilListTable
            airfoils={airfoils}
            airfoilPolars={airfoilPolars}
            selectedId={selected.id}
            detailOpen={detailOpen}
            visibleAirfoilIds={visibleAirfoilIds}
            onOpenDetail={openDetail}
            onToggleChartLine={toggleChartLine}
          />
          <AirfoilAnalysisCaseTable cases={cases} />
        </div>

        <div className="space-y-5">
          <AirfoilAnalysisSettingsCard polarReady={polarReady} onCreatePolar={() => setPolarReady(true)} />
          <AirfoilNextStepsCard />
        </div>
      </div>

      <AirfoilDetailDrawer
        airfoil={selected}
        open={detailOpen}
        polarReady={polarReady}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
