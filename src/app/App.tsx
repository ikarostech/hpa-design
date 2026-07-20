import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { JobProvider } from "../shared/jobs/JobProvider";
import { AppLayout } from "../shared/layout/AppLayout";
import { DesignDocumentProvider, useDesignDocument } from "./DesignDocumentProvider";
import { listAirfoilReferences } from "./designDocument";
import { designDocumentExporter, designDocumentImporter, formatValidationIssues } from "./designDocumentTransfer";

const AirfoilPage = lazy(async () => ({ default: (await import("../pages/AirfoilPage")).AirfoilPage }));
const AircraftWorkspacePage = lazy(async () => ({ default: (await import("../pages/AircraftWorkspacePage")).AircraftWorkspacePage }));
const AnalysisPage = lazy(async () => ({ default: (await import("../pages/AnalysisPage")).AnalysisPage }));
const DashboardPage = lazy(async () => ({ default: (await import("../pages/DashboardPage")).DashboardPage }));
const ExportPage = lazy(async () => ({ default: (await import("../pages/ExportPage")).ExportPage }));

export default function App() {
  return <DesignDocumentProvider><JobProvider><AppLayout><Suspense fallback={<div className="p-4 text-sm text-slate-500" role="status">画面を読み込んでいます…</div>}><Routes>
    <Route path="/" element={<DashboardRoute />} />
    <Route path="/airfoils" element={<AirfoilRoute />} />
    <Route path="/aircraft" element={<AircraftRoute />} />
    <Route path="/analysis" element={<AnalysisRoute />} />
    <Route path="/export" element={<ExportRoute />} />
    <Route path="/projects/*" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AppLayout></JobProvider></DesignDocumentProvider>;
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
  return <AirfoilPage data={{ designName: document.name, airfoils: document.airfoils, polars: document.polars, analysisRuns: document.airfoilAnalysisRuns, airfoilRepository, getAirfoilReferences: (airfoilId) => listAirfoilReferences(document, airfoilId), saveAnalysis: saveAirfoilAnalysis, updateAnalysisRun: updateAirfoilAnalysisRun, removeAnalysisRun: removeAirfoilAnalysisRun }} />;
}

function AircraftRoute() {
  const { document, updateAircraft } = useDesignDocument();
  return <AircraftWorkspacePage aircraft={document.aircraft} airfoils={document.airfoils} onUpdateAircraft={updateAircraft} />;
}

function AnalysisRoute() {
  const { document, analysisCaseRepository, saveAnalysisResult } = useDesignDocument();
  return <AnalysisPage aircraft={document.aircraft} cases={document.analysisCases} results={document.analysisResults} polarIds={document.polars.map((polar) => polar.id)} analysisCaseRepository={analysisCaseRepository} saveAnalysisResult={saveAnalysisResult} />;
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
