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
const FsiPage = lazy(async () => ({ default: (await import("../pages/FsiPage")).FsiPage }));
const DashboardPage = lazy(async () => ({ default: (await import("../pages/DashboardPage")).DashboardPage }));
const ExportPage = lazy(async () => ({ default: (await import("../pages/ExportPage")).ExportPage }));
const StructuresPage = lazy(async () => ({ default: (await import("../pages/StructuresPage")).StructuresPage }));
const ConceptualDesignPage = lazy(async () => ({ default: (await import("../pages/ConceptualDesignPage")).ConceptualDesignPage }));

export default function App() {
  return <DesignDocumentProvider><JobProvider><AppLayout><Suspense fallback={<div className="p-4 text-sm text-slate-500" role="status">画面を読み込んでいます…</div>}><Routes>
    <Route path="/" element={<DashboardRoute />} />
    <Route path="/conceptual-design" element={<ConceptualDesignRoute />} />
    <Route path="/aerodynamics" element={<Navigate to="/aerodynamics/airfoils" replace />} />
    <Route path="/aerodynamics/airfoils" element={<AirfoilRoute />} />
    <Route path="/aerodynamics/geometry" element={<AircraftRoute />} />
    <Route path="/aerodynamics/analysis" element={<AnalysisRoute />} />
    <Route path="/fsi" element={<FsiRoute />} />
    <Route path="/structures" element={<StructuresRoute />} />
    <Route path="/export" element={<ExportRoute />} />
    <Route path="/airfoils" element={<Navigate to="/aerodynamics/airfoils" replace />} />
    <Route path="/aircraft" element={<Navigate to="/aerodynamics/geometry" replace />} />
    <Route path="/analysis" element={<Navigate to="/aerodynamics/analysis" replace />} />
    <Route path="/results" element={<Navigate to="/fsi" replace />} />
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

function FsiRoute() {
  const { document, saveAeroelasticResult } = useDesignDocument();
  return <FsiPage aircraft={document.aircraft} polars={document.polars} materials={document.carbonMaterials} structuralDesigns={document.structuralDesigns} results={document.aeroelasticResults ?? []} onSaveResult={saveAeroelasticResult} />;
}

function StructuresRoute() {
  const { document, saveCarbonMaterial, removeCarbonMaterial, saveStructuralDesign, removeStructuralDesign, saveStructuralResult } = useDesignDocument();
  return <StructuresPage aircraft={document.aircraft} aerodynamicResults={document.analysisResults} grossMass={document.conceptualDesign?.grossMass} materials={document.carbonMaterials} designs={document.structuralDesigns} results={document.structuralResults} onSaveMaterial={saveCarbonMaterial} onRemoveMaterial={removeCarbonMaterial} onSaveDesign={saveStructuralDesign} onRemoveDesign={removeStructuralDesign} onSaveResult={saveStructuralResult} />;
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
