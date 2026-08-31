import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { AnalysisResult } from "../features/analysis/model/types";
import { StructuralDesignTab } from "../features/structures/components/StructuralDesignTab";
import { StructuralLoadsTab } from "../features/structures/components/StructuralLoadsTab";
import { StructuralResultsTab } from "../features/structures/components/StructuralResultsTab";
import { createDefaultStructuralDesign, createStructuralId } from "../features/structures/model/structuralWorkspace";
import type { CarbonMaterial, StructuralAnalysisResult, StructuralDesign, StructuralLoadCase } from "../features/structures/model/types";
import { executeStructuralAnalysis } from "../features/structures/services/structuralAnalysis";
import { Button } from "../shared/ui/Button";
import { Card, CardBody } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";

interface StructuresPageProps {
  aircraft: AircraftGeometry;
  aerodynamicResults: readonly AnalysisResult[];
  materials: readonly CarbonMaterial[];
  designs: readonly StructuralDesign[];
  results: readonly StructuralAnalysisResult[];
  onSaveMaterial: (material: CarbonMaterial) => void;
  onRemoveMaterial: (materialId: string) => void;
  onSaveDesign: (design: StructuralDesign) => void;
  onRemoveDesign: (designId: string) => void;
  onSaveResult: (result: StructuralAnalysisResult) => void;
}

type Tab = "設計" | "荷重ケース" | "結果";

export function StructuresPage(props: StructuresPageProps) {
  const { aircraft, aerodynamicResults, materials, designs, results, onSaveMaterial, onRemoveMaterial, onSaveDesign, onRemoveDesign, onSaveResult } = props;
  const [activeTab, setActiveTab] = useState<Tab>("設計");
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(designs[0]?.id ?? null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(designs[0]?.sections[0]?.id ?? null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [pendingDesignDelete, setPendingDesignDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!designs.some((design) => design.id === selectedDesignId)) setSelectedDesignId(designs[0]?.id ?? null);
  }, [designs, selectedDesignId]);

  const design = designs.find((item) => item.id === selectedDesignId) ?? designs[0];
  const designResults = results.filter((result) => result.designId === design?.id);
  const result = designResults.find((item) => item.id === selectedResultId) ?? designResults[0];

  const saveDesign = (next: StructuralDesign) => {
    setError(null);
    onSaveDesign(next);
  };

  const run = (loadCase: StructuralLoadCase) => {
    if (!design) return;
    try {
      const next = executeStructuralAnalysis({ design, loadCase, materials, resultId: createStructuralId("structural-result") });
      onSaveResult(next);
      setSelectedResultId(next.id);
      setActiveTab("結果");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "構造解析に失敗しました。");
    }
  };

  const createDesign = () => {
    const next = createDefaultStructuralDesign(aircraft, materials[0]);
    onSaveDesign(next);
    setSelectedDesignId(next.id);
  };

  return <>
    <PageTemplate
      title="主翼カーボンパイプ構造設計"
      description="円形積層管の剛性、重量、たわみ、ねじれ、曲げ安全率を評価します。"
      actions={<>
        <select aria-label="構造設計" value={design?.id ?? ""} onChange={(event) => setSelectedDesignId(event.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm">{designs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Button variant="secondary" onClick={createDesign}><Plus size={16} />構造案</Button>
        {design ? <Button variant="destructive" size="icon" aria-label={`${design.name}を削除`} title={`${design.name}を削除`} onClick={() => setPendingDesignDelete(true)}><Trash2 size={16} /></Button> : null}
      </>}
      tabs={<div role="tablist" className="flex border-b border-slate-200">{(["設計", "荷重ケース", "結果"] as const).map((tab) => <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>{tab}</button>)}</div>}
      notices={error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
    >
      {!design
        ? <EmptyDesign onCreate={createDesign} />
        : activeTab === "設計"
          ? <StructuralDesignTab design={design} designs={designs} materials={materials} selectedSectionId={selectedSectionId} onSelectSection={setSelectedSectionId} onSaveDesign={saveDesign} onSaveMaterial={onSaveMaterial} onRemoveMaterial={onRemoveMaterial} />
          : activeTab === "荷重ケース"
            ? <StructuralLoadsTab design={design} aircraft={aircraft} aerodynamicResults={aerodynamicResults} onSaveDesign={saveDesign} onRun={run} />
            : <StructuralResultsTab results={designResults} result={result} onSelectResult={setSelectedResultId} />}
    </PageTemplate>
    <DeleteConfirmationDialog
      open={pendingDesignDelete && Boolean(design)}
      title="構造案を削除"
      description={design ? `「${design.name}」と、その荷重ケース、関連する解析結果も削除します。` : ""}
      onCancel={() => setPendingDesignDelete(false)}
      onConfirm={() => {
        if (design) onRemoveDesign(design.id);
        setPendingDesignDelete(false);
      }}
    />
  </>;
}

function EmptyDesign({ onCreate }: { onCreate: () => void }) {
  return <Card><CardBody className="py-10 text-center"><p className="text-sm text-slate-500">構造設計がありません。</p><Button className="mt-4" onClick={onCreate}>最初の構造設計を作成</Button></CardBody></Card>;
}
