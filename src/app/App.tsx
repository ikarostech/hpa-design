import { Navigate, Route, Routes } from "react-router-dom";
import { AirfoilPage } from "../pages/AirfoilPage";
import { AircraftWorkspacePage } from "../pages/AircraftWorkspacePage";
import { AnalysisPage } from "../pages/AnalysisPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ExportPage } from "../pages/ExportPage";
import { JobProvider } from "../shared/jobs/JobProvider";
import { AppLayout } from "../shared/layout/AppLayout";
import { DesignDocumentProvider, useDesignDocument } from "./DesignDocumentProvider";
import { designDocumentExporter, designDocumentImporter, formatValidationIssues } from "./designDocumentTransfer";

export default function App() {
  return <DesignDocumentProvider><JobProvider><AppLayout><Routes>
    <Route path="/" element={<DashboardRoute />} />
    <Route path="/airfoils" element={<AirfoilRoute />} />
    <Route path="/aircraft" element={<AircraftRoute />} />
    <Route path="/analysis" element={<AnalysisRoute />} />
    <Route path="/export" element={<ExportRoute />} />
    <Route path="/projects/*" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AppLayout></JobProvider></DesignDocumentProvider>;
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
  const { document, airfoilRepository, saveAirfoilAnalysis } = useDesignDocument();
  return <AirfoilPage data={{ airfoils: document.airfoils, polars: document.polars, analysisRuns: document.airfoilAnalysisRuns, airfoilRepository, saveAnalysis: saveAirfoilAnalysis }} />;
}

function AircraftRoute() {
  const { document, updateAircraft } = useDesignDocument();
  return <AircraftWorkspacePage aircraft={document.aircraft} airfoils={document.airfoils} onUpdateAircraft={updateAircraft} />;
}

function AnalysisRoute() {
  const { document } = useDesignDocument();
  return <AnalysisPage aircraft={document.aircraft} cases={document.analysisCases} results={document.analysisResults} />;
}

function ExportRoute() {
  const { document, markDocumentSaved } = useDesignDocument();
  return <ExportPage onExport={() => void exportDocument(document, markDocumentSaved)} />;
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
