import { Navigate, Route, Routes } from "react-router-dom";
import { AirfoilPage } from "../pages/AirfoilPage";
import { AircraftWorkspacePage } from "../pages/AircraftWorkspacePage";
import { AnalysisPage } from "../pages/AnalysisPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ExportPage } from "../pages/ExportPage";
import { AppLayout } from "../shared/layout/AppLayout";
import { JobProvider } from "../shared/jobs/JobProvider";

export default function App() {
  return (
    <JobProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<DashboardPage />} />
          <Route path="/airfoils" element={<AirfoilPage />} />
          <Route path="/aircraft" element={<AircraftWorkspacePage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </JobProvider>
  );
}
