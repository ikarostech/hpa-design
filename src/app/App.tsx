import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { JobProvider } from "../shared/jobs/JobProvider";
import { AppLayout } from "../shared/layout/AppLayout";
import { DesignDocumentProvider, useDesignDocument } from "./DesignDocumentProvider";
import { listAirfoilReferences } from "./designDocument";
import { designDocumentExporter, designDocumentImporter, formatValidationIssues } from "./designDocumentTransfer";
import { createDefaultConceptualDesign } from "../features/conceptual-design/model/conceptualDesign";

const AirfoilPage = lazy(async () => ({ default: (await import("../pages/AirfoilPage")).AirfoilPage }));
const AircraftWorkspacePage = lazy(async () => ({ default: (await import("../pages/AircraftWorkspacePage")).AircraftWorkspacePage }));
const AnalysisPage = lazy(async () => ({ default: (await import("../pages/AnalysisPage")).AnalysisPage }));
const ResultsPage = lazy(async () => ({ default: (await import("../pages/ResultsPage")).ResultsPage }));
const DashboardPage = lazy(async () => ({ default: (await import("../pages/DashboardPage")).DashboardPage }));
const ExportPage = lazy(async () => ({ default: (await import("../pages/ExportPage")).ExportPage }));
const StructuresPage = lazy(async () => ({ default: (await import("../pages/StructuresPage")).StructuresPage }));
const ConceptualDesignPage = lazy(async () => ({ default: (await import("../pages/ConceptualDesignPage")).ConceptualDesignPage }));

export default function App() {
  return <DesignDocumentProvider><JobProvider><AppLayout><Suspense fallback={<div className="p-4 text-sm text-slate-500" role="status">画面を読み込んでいます…</div>}><Routes>
    <Route path="/" element={<DashboardRoute />} />
    <Route path="/conceptual-design" element={<ConceptualDesignRoute />} />
    <Route path="/airfoils" element={<AirfoilRoute />} />
    <Route path="/aircraft" element={<AircraftRoute />} />
    <Route path="/analysis" element={<AnalysisRoute />} />
    <Route path="/results" element={<ResultsRoute />} />
    <Route path="/structures" element={<StructuresRoute />} />
    <Route path="/export" element={<ExportRoute />} />
    <Route path="/projects/*" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AppLayout></JobProvider></DesignDocumentProvider>;
}

function ConceptualDesignRoute() {
  const { document, updateConceptualDesign } = useDesignDocument();
  return <ConceptualDesignPage conceptualDesign={document.conceptualDesign ?? createDefaultConceptualDesign()} aircraft={document.aircraft} onSave={updateConceptualDesign} />;
}

function DashboardRoute() {
  const { document, isDirty, markDocumentSaved, replaceDocument } = useDesignDocument();
  return <DashboardPage document={document} onImportFile={async (file) => {
    const imported = await designDocumentImporter.parse(await file.text());
    const validation = await designDocumentImporter.validate(imported);
    if (!validation.valid) throw new Error(formatValidationIssues(validation.issues));
    replaceDocument(imported);
  }} isDirty={isDirty} onExport={() => void exportDocument(document, markDocumentSaved)} />;
}

function AirfoilRoute() {
  const { document, airfoilRepository, saveAirfoilAnalysis, updateAirfoilAnalysisRun, removeAirfoilAnalysisRun } = useDesignDocument();
  const matchingCases = document.analysisCases.filter((analysisCase) => analysisCase.geometryId === document.aircraft?.id);
  const defaultReynolds = matchingCases.find((analysisCase) => analysisCase.status !== "completed")?.reynolds ?? matchingCases[0]?.reynolds;
  return <AirfoilPage data={{ designName: document.name, defaultReynolds, airfoils: document.airfoils, polars: document.polars, analysisRuns: document.airfoilAnalysisRuns, airfoilRepository, getAirfoilReferences: (airfoilId) => listAirfoilReferences(document, airfoilId), saveAnalysis: saveAirfoilAnalysis, updateAnalysisRun: updateAirfoilAnalysisRun, removeAnalysisRun: removeAirfoilAnalysisRun }} />;
}

function AircraftRoute() {
  const { document, updateAircraft } = useDesignDocument();
  return <AircraftWorkspacePage aircraft={document.aircraft} airfoils={document.airfoils} onUpdateAircraft={updateAircraft} />;
}

function AnalysisRoute() {
  const { document, analysisCaseRepository, saveAnalysisResult } = useDesignDocument();
  return <AnalysisPage aircraft={document.aircraft} cases={document.analysisCases} results={document.analysisResults} polars={document.polars} analysisCaseRepository={analysisCaseRepository} saveAnalysisResult={saveAnalysisResult} />;
}

function ResultsRoute() {
  const { document } = useDesignDocument();
  return <ResultsPage cases={document.analysisCases} results={document.analysisResults} structuralResults={document.structuralResults} />;
}

function StructuresRoute() {
  const { document, saveCarbonMaterial, removeCarbonMaterial, saveStructuralDesign, removeStructuralDesign, saveStructuralResult } = useDesignDocument();
  return <StructuresPage aircraft={document.aircraft} aerodynamicResults={document.analysisResults} materials={document.carbonMaterials} designs={document.structuralDesigns} results={document.structuralResults} onSaveMaterial={saveCarbonMaterial} onRemoveMaterial={removeCarbonMaterial} onSaveDesign={saveStructuralDesign} onRemoveDesign={removeStructuralDesign} onSaveResult={saveStructuralResult} />;
}

function ExportRoute() {
  const { document, markDocumentSaved } = useDesignDocument();
  return <ExportPage document={document} onExportDocument={() => void exportDocument(document, markDocumentSaved)} />;
}

async function exportDocument(designDocument: Parameters<typeof designDocumentExporter.export>[0], markDocumentSaved: () => void) {
  await downloadDocument(designDocument);
  markDocumentSaved();
}

async function downloadDocument(designDocument: Parameters<typeof designDocumentExporter.export>[0]) {
  const content = await designDocumentExporter.export(designDocument);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${designDocument.name.replaceAll(/[^a-zA-Z0-9_-]+/g, "-") || "hpa-design"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
