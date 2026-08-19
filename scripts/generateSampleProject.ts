import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { executeAnalysisCase } from "../src/features/analysis/services/analysisExecutionService";
import { executeStructuralAnalysis } from "../src/features/structures/services/structuralAnalysis";
import { createLoadCaseFromAerodynamicResult } from "../src/features/structures/services/structuralLoadService";
import {
  aircraftGeometry,
  airfoilPolars,
  airfoils,
  analysisCases,
  carbonMaterials,
  structuralDesigns,
} from "../src/mocks/mockData";

const outputPath = resolve("examples/HPADesign-Aero-Structural-MVP.json");
const analysisCase = { ...analysisCases[0], name: "HPA Cruise 20m/s", status: "completed" as const };
const analysisResult = await executeAnalysisCase({
  analysisCase,
  aircraft: aircraftGeometry,
  polars: airfoilPolars,
  createId: () => "sample-aero-vlm-cruise",
  onProgress: () => undefined,
});
const selectedAlpha = 14;
const aerodynamicLoadCase = {
  ...createLoadCaseFromAerodynamicResult({ result: analysisResult, aircraft: aircraftGeometry, alphaDegrees: selectedAlpha }),
  name: `巡航 VLM α=${selectedAlpha}°（空力結果から生成）`,
  status: "completed" as const,
};
const material = {
  ...carbonMaterials[0],
  name: "T700 UD（サンプル値）",
  note: "初期検討用の代表値です。実機設計では材料試験値へ置き換えてください。",
};
const structuralDesign = {
  ...structuralDesigns[0],
  name: "HPA 主翼メインスパー",
  sections: structuralDesigns[0].sections.map((section) => ({ ...section, plies: section.plies.map((ply) => ({ ...ply })) })),
  loadCases: [aerodynamicLoadCase],
};
const structuralResult = executeStructuralAnalysis({
  design: structuralDesign,
  loadCase: aerodynamicLoadCase,
  materials: [material],
  resultId: "sample-structure-vlm-alpha-14",
  sampleCount: 81,
});
const document = {
  schemaVersion: 4,
  name: "HPADesign 空力・構造 MVP サンプル",
  airfoils,
  polars: airfoilPolars,
  airfoilAnalysisRuns: [{
    id: "run-initial-polars",
    name: "初期 Polar 解析",
    airfoilIds: Array.from(new Set(airfoilPolars.map((polar) => polar.airfoilId))),
    polarIds: airfoilPolars.map((polar) => polar.id),
    createdAt: "2026-08-19T00:00:00.000Z",
    reynolds: 300000,
    mach: 0.04,
    alphaStart: -6,
    alphaEnd: 18,
    alphaStep: 2,
    status: "complete",
  }],
  aircraft: aircraftGeometry,
  analysisCases: [analysisCase, ...analysisCases.slice(1)],
  analysisResults: [analysisResult],
  carbonMaterials: [material],
  structuralDesigns: [structuralDesign],
  structuralResults: [{ ...structuralResult, createdAt: "2026-08-19T00:00:00.000Z" }],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
