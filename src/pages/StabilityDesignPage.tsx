import { StabilityDesignTabs } from "./StabilityDesignTabs";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { AnalysisWorkspace, type AnalysisPageProps } from "./AnalysisPage";
import type { StructuralAnalysisResult } from "../features/structures/model/types";
import { stabilityShapeErrors, type StabilityStructuralShapeOption } from "../features/analysis/model/stabilityShape";
import type { AnalysisCaseDraft } from "../features/analysis/model/analysisCaseDraft";
import type { AircraftGeometry } from "../features/aircraft/model/types";
type StructuralShapeResult = Pick<StructuralAnalysisResult, "id" | "status" | "createdAt"> & {
  designSnapshot: Pick<StructuralAnalysisResult["designSnapshot"], "name">;
  loadCaseSnapshot: Pick<StructuralAnalysisResult["loadCaseSnapshot"], "name" | "loadFactor" | "safetyFactor">;
  points: Pick<StructuralAnalysisResult["points"][number], "yPosition" | "deflection" | "twist">[];
};
type StabilityDesignPageProps = Omit<AnalysisPageProps,
  "scope" | "renderCaseDesignInputs" | "initialStabilityInputs" | "introduction" | "stabilityFsiShapes" | "stabilityPhase" | "fixedFsiShape" | "creationDisabledReason" | "comparisonResults"> & {
    structuralResults?: readonly StructuralShapeResult[];
  };

export function StabilityDesignPage({ structuralResults = [], ...analysisProps }: StabilityDesignPageProps) {
  return <PageTemplate title="安定性設計" tabs={<StabilityDesignTabs />}>
    <AnalysisWorkspace {...analysisProps} initialStabilityInputs={{ stabilityGeometry: analysisProps.aircraft, stabilityShape: { kind: "rigid" } }}
      renderCaseDesignInputs={(draft, onChange) => <StabilityCaseDesignInputs aircraft={analysisProps.aircraft} structuralResults={structuralResults} draft={draft} onChange={onChange} />}
      scope="aircraft" stabilityPhase="pre-fsi" />
  </PageTemplate>;
}

function StabilityCaseDesignInputs({ aircraft, structuralResults, draft, onChange }: {
  aircraft: AircraftGeometry; structuralResults: readonly StructuralShapeResult[];
  draft: AnalysisCaseDraft; onChange: (draft: AnalysisCaseDraft) => void;
}) {
  const geometry = draft.stabilityGeometry ?? aircraft;
  const shapes: StabilityStructuralShapeOption[] = structuralResults.filter((result) => result.status === "completed").map((result) => ({
    id: result.id,
    label: `${result.designSnapshot.name} / ${result.loadCaseSnapshot.name} / 荷重係数 ${result.loadCaseSnapshot.loadFactor}・安全率 ${result.loadCaseSnapshot.safetyFactor} / ${result.createdAt}`,
    shape: { kind: "manual" as const, elasticAxisChordFraction: geometry.sparChordFraction ?? 0.35,
      points: result.points.map(({ yPosition, deflection, twist }) => ({ yPosition, deflection, twist })) },
  })).filter(({ shape }) => !stabilityShapeErrors(shape, geometry.span / 2).length);
  const selectedStructure = shapes.find((item) => JSON.stringify(item.shape) === JSON.stringify(draft.stabilityShape));
  const savedShape = draft.stabilityShape?.kind === "manual" && !selectedStructure;
  const sameWing = JSON.stringify({ ...geometry, tailSurfaces: undefined }) === JSON.stringify({ ...aircraft, tailSurfaces: undefined });
  const sameTails = JSON.stringify(geometry.tailSurfaces ?? []) === JSON.stringify(aircraft.tailSurfaces ?? []);
  const tailId = sameTails ? "current" : geometry.tailSurfaces?.length ? "saved" : "none";
  return (
    <section aria-label="解析に使う設計" className="min-w-0 space-y-2 sm:col-span-2">
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <label className="grid min-w-0 gap-1 text-sm text-slate-700"><span>主翼</span>
          <select className="w-full min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={sameWing ? "current" : "saved"} onChange={(event) => {
            if (event.target.value === "current") onChange({ ...draft, geometryId: aircraft.id, stabilityGeometry: structuredClone({ ...aircraft, tailSurfaces: geometry.tailSurfaces }) });
          }}>
            {!sameWing ? <option value="saved">ケースに保存済みの主翼（翼幅 {geometry.span} m）</option> : null}
            <option value="current">現在の主翼設計（翼幅 {aircraft.span} m）</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm text-slate-700"><span>構造</span>
          <select className="w-full min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={selectedStructure?.id ?? (savedShape ? "saved" : "")} onChange={(event) => {
            const selected = shapes.find((item) => item.id === event.target.value);
            if (event.target.value === "saved") return;
            onChange({ ...draft, stabilityGeometry: structuredClone(geometry), stabilityShape: selected ? structuredClone(selected.shape) : { kind: "rigid" } });
          }}>
            {savedShape ? <option value="saved">保存済み／手入力のたわみ・ねじり</option> : null}
            <option value="">剛体（構造変形なし）</option>{shapes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm text-slate-700"><span>尾翼</span>
          <select className="w-full min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={tailId} onChange={(event) => {
            if (event.target.value === "saved") return;
            onChange({ ...draft, stabilityGeometry: structuredClone({ ...geometry, tailSurfaces: event.target.value === "none" ? [] : aircraft.tailSurfaces }) });
          }}>
            {tailId === "saved" ? <option value="saved">ケースに保存済みの尾翼（{geometry.tailSurfaces?.map((tail) => tail.name).join("・")}）</option> : null}
            <option value="current">現在の尾翼設計（{aircraft.tailSurfaces?.map((tail) => tail.name).join("・") || "未設定"}）</option>
            <option value="none">尾翼なし</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">解析済みの構造結果を選ぶと、たわみ・ねじり分布を自動で取り込みます。荷重係数・安全率を含む変形をそのままケースに保存し、固定して評価します。</p>
      {!shapes.length ? <p className="text-xs text-slate-500">選択できる構造結果がありません。主翼半幅に合う構造の単独解析を実行すると選べます。要確認の結果は選択できません。</p> : null}
    </section>
  );
}
