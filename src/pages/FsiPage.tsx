import type { AircraftGeometry } from "../features/aircraft/model/types";
import { AeroelasticAnalysisPanel } from "../features/aeroelastic/components/AeroelasticAnalysisPanel";
import type { StaticAeroelasticResult } from "../features/aeroelastic/services/staticAeroelasticSolver";
import type { AirfoilPolar } from "../features/airfoils/model/types";
import type { CarbonMaterial, StructuralDesign } from "../features/structures/model/types";
import { Card, CardBody } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

interface FsiPageProps {
  aircraft: AircraftGeometry;
  polars: readonly AirfoilPolar[];
  materials: readonly CarbonMaterial[];
  structuralDesigns: readonly StructuralDesign[];
  results: readonly StaticAeroelasticResult[];
  onSaveResult: (result: StaticAeroelasticResult) => void;
}

export function FsiPage({ aircraft, polars, materials, structuralDesigns, results, onSaveResult }: FsiPageProps) {
  return <PageTemplate
    title="空力・構造連成（FSI）"
    description="空力設計と構造設計を組み合わせ、変形後の主翼形状で空力荷重を再計算して収束状態を評価します。"
  >
    <div className="grid gap-4 lg:grid-cols-3">
      <InputSummary
        title="空力設計から"
        detail={`主翼 ${aircraft.sections.length}断面・Polar ${polars.filter((polar) => polar.status === "complete").length}件を使用`}
        note="剛体翼の形状、翼型、空力特性"
      />
      <InputSummary
        title="構造設計から"
        detail={`構造案 ${structuralDesigns.length}件・材料 ${materials.length}件`}
        note="梁の剛性、強度、重量、支持条件"
      />
      <InputSummary
        title="FSIで評価"
        detail={`保存済み連成結果 ${results.length}件`}
        note="荷重再配分、変形後性能、収束状態"
      />
    </div>
    <AeroelasticAnalysisPanel
      aircraft={aircraft}
      polars={polars}
      materials={materials}
      structuralDesigns={structuralDesigns}
      results={results}
      onSaveResult={onSaveResult}
    />
  </PageTemplate>;
}

function InputSummary({ title, detail, note }: { title: string; detail: string; note: string }) {
  return <Card><CardBody className="space-y-1">
    <h2 className="font-semibold text-slate-950">{title}</h2>
    <p className="text-sm text-slate-700">{detail}</p>
    <p className="text-xs text-slate-500">{note}</p>
  </CardBody></Card>;
}
