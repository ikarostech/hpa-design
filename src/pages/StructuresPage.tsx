import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AircraftGeometry } from "../features/aircraft/model/types";
import type { AnalysisResult } from "../features/analysis/model/types";
import { StructuralDesignTab } from "../features/structures/components/StructuralDesignTab";
import { StructuralLoadsTab } from "../features/structures/components/StructuralLoadsTab";
import { StructuralResultsTab } from "../features/structures/components/StructuralResultsTab";
import { createDefaultStructuralDesign, createStructuralId } from "../features/structures/model/structuralWorkspace";
import type { CarbonMaterial, StructuralAnalysisResult, StructuralDesign, StructuralLoadCase } from "../features/structures/model/types";
import { StructuralAnalysisCancelledError, webStructuralAnalysisRunner, type StructuralAnalysisRunner } from "../features/structures/services/webStructuralAnalysisRunner";
import { useJobs } from "../shared/jobs/JobProvider";
import type { Job } from "../shared/model";
import { Button } from "../shared/ui/Button";
import { Card, CardBody } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";
import { DeleteConfirmationDialog } from "../shared/ui/table/DeleteConfirmationDialog";

interface StructuresPageProps {
  aircraft: AircraftGeometry;
  aerodynamicResults: readonly AnalysisResult[];
  grossMass?: number;
  materials: readonly CarbonMaterial[];
  designs: readonly StructuralDesign[];
  results: readonly StructuralAnalysisResult[];
  onSaveMaterial: (material: CarbonMaterial) => void;
  onRemoveMaterial: (materialId: string) => void;
  onSaveDesign: (design: StructuralDesign) => void;
  onRemoveDesign: (designId: string) => void;
  onSaveResult: (result: StructuralAnalysisResult) => void;
  analysisRunner?: StructuralAnalysisRunner;
}

type StructuralAnalysisJob = Job<string, StructuralAnalysisResult, { designId: string; loadCaseId: string }> & {
  kind: "structural-analysis";
  settings: { designId: string; loadCaseId: string };
};

type Tab = "構造案" | "基準荷重" | "単独解析";

export function StructuresPage(props: StructuresPageProps) {
  const { aircraft, aerodynamicResults, grossMass = 100, materials, designs, results, onSaveMaterial, onRemoveMaterial, onSaveDesign, onRemoveDesign, onSaveResult, analysisRunner = webStructuralAnalysisRunner } = props;
  const jobs = useJobs();
  const controllers = useRef(new Map<string, AbortController>());
  const [activeTab, setActiveTab] = useState<Tab>("構造案");
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
  const runningJobs = jobs.jobs.filter(hasStructuralSettings).filter((job) => job.status === "running");

  const saveDesign = (next: StructuralDesign) => {
    setError(null);
    onSaveDesign(next);
  };

  const run = async (loadCase: StructuralLoadCase) => {
    if (!design) return;
    if (runningJobs.some((job) => job.settings.loadCaseId === loadCase.id)) return;
    const jobId = createStructuralId("job-structural-analysis");
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    controllers.current.set(jobId, controller);
    jobs.createJob<StructuralAnalysisJob>({
      id: jobId,
      kind: "structural-analysis",
      name: `${loadCase.name} 構造解析`,
      status: "running",
      createdAt: startedAt,
      startedAt,
      progress: { completed: 0, total: 1, message: "構造解析を実行中…" },
      settings: { designId: design.id, loadCaseId: loadCase.id },
    });
    try {
      const next = await analysisRunner.run({ design, loadCase, materials, resultId: createStructuralId("structural-result") }, controller.signal);
      onSaveResult(next);
      setSelectedResultId(next.id);
      setActiveTab("単独解析");
      jobs.completeJob<StructuralAnalysisJob>(jobId, { result: next, progress: { completed: 1, total: 1, message: "構造解析が完了しました" } });
    } catch (cause) {
      if (cause instanceof StructuralAnalysisCancelledError) jobs.cancelJob(jobId);
      else {
        const message = cause instanceof Error ? cause.message : "構造解析に失敗しました。";
        setError(message);
        jobs.failJob(jobId, message);
      }
    } finally {
      controllers.current.delete(jobId);
    }
  };

  const createDesign = () => {
    const next = createDefaultStructuralDesign(aircraft, materials[0]);
    onSaveDesign(next);
    setSelectedDesignId(next.id);
  };

  return <>
    <PageTemplate
      title="構造設計"
      description="想定重量の楕円分布を基準荷重として構造案を作り、空力荷重との違い、強度、重量、変形を評価します。"
      actions={<>
        <select aria-label="構造設計" value={design?.id ?? ""} onChange={(event) => setSelectedDesignId(event.target.value)} className="h-9 rounded-md border bg-white px-3 text-sm">{designs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <Button variant="secondary" onClick={createDesign}><Plus size={16} />構造案</Button>
        {design ? <Button variant="destructive" size="icon" aria-label={`${design.name}を削除`} title={`${design.name}を削除`} onClick={() => setPendingDesignDelete(true)}><Trash2 size={16} /></Button> : null}
      </>}
      tabs={<div role="tablist" className="flex border-b border-slate-200">{(["構造案", "基準荷重", "単独解析"] as const).map((tab) => <button role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium ${activeTab === tab ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>{tab}</button>)}</div>}
      notices={<>{runningJobs.length ? <div role="status" aria-live="polite" className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{runningJobs[0].settings.loadCaseId ? `${design?.loadCases.find((item) => item.id === runningJobs[0].settings.loadCaseId)?.name ?? "構造荷重ケース"}を解析中…` : "構造解析を実行中…"}</div> : null}{error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}</>}
    >
      {!design
        ? <EmptyDesign onCreate={createDesign} />
        : activeTab === "構造案"
          ? <StructuralDesignTab design={design} designs={designs} materials={materials} selectedSectionId={selectedSectionId} onSelectSection={setSelectedSectionId} onSaveDesign={saveDesign} onSaveMaterial={onSaveMaterial} onRemoveMaterial={onRemoveMaterial} />
          : activeTab === "基準荷重"
            ? <StructuralLoadsTab design={design} aircraft={aircraft} grossMass={grossMass} aerodynamicResults={aerodynamicResults} onSaveDesign={saveDesign} onRun={(loadCase) => void run(loadCase)} runningLoadCaseIds={runningJobs.map((job) => job.settings.loadCaseId)} onCancel={(loadCaseId) => { const job = runningJobs.find((item) => item.settings.loadCaseId === loadCaseId); if (job) controllers.current.get(job.id)?.abort(); }} />
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

function hasStructuralSettings(job: Job<string, unknown, unknown>): job is StructuralAnalysisJob {
  return job.kind === "structural-analysis" && typeof job.settings === "object" && job.settings !== null && "designId" in job.settings && "loadCaseId" in job.settings;
}

function EmptyDesign({ onCreate }: { onCreate: () => void }) {
  return <Card><CardBody className="py-10 text-center"><p className="text-sm text-slate-500">構造設計がありません。</p><Button className="mt-4" onClick={onCreate}>最初の構造設計を作成</Button></CardBody></Card>;
}
