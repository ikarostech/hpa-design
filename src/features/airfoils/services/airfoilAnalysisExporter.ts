import type { Exporter } from "../../../shared/model";
import type { AirfoilAnalysisRun, AirfoilPolar } from "../model/types";

export interface AirfoilAnalysisExportFile { fileName: string; mimeType: string; content: string; }
export interface AirfoilAnalysisExportInput { designName: string; run: AirfoilAnalysisRun; polars: readonly AirfoilPolar[]; }

export const airfoilAnalysisExporter: Exporter<AirfoilAnalysisExportInput, AirfoilAnalysisExportFile> & { exportJson: (input: AirfoilAnalysisExportInput) => Promise<AirfoilAnalysisExportFile> } = {
  export: async ({ designName, run, polars }) => ({
    fileName: `${fileStem(designName)}-${fileStem(run.name)}-polars.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: `\uFEFFrun_id,polar_id,airfoil_id,reynolds,mach,alpha_deg,cl,cd,cm\r\n${polars.filter((polar) => run.polarIds.includes(polar.id)).flatMap((polar) => polar.points.map((point) => [run.id, polar.id, polar.airfoilId, String(polar.reynolds), format(polar.mach, 3), format(point.alpha, 1), format(point.cl, 4), format(point.cd, 6), format(point.cm, 4)].join(","))).join("\r\n")}${polars.some((polar) => run.polarIds.includes(polar.id) && polar.points.length) ? "\r\n" : ""}`,
  }),
  exportJson: async ({ designName, run, polars }) => ({ fileName: `${fileStem(designName)}-${fileStem(run.name)}-polars.json`, mimeType: "application/json;charset=utf-8", content: JSON.stringify({ run, polars: polars.filter((polar) => run.polarIds.includes(polar.id)) }, null, 2) }),
};

function format(value: number, digits: number) { const factor = 10 ** digits; return (Math.round((value + Number.EPSILON) * factor) / factor).toFixed(digits); }
function fileStem(value: string) { return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "hpa-design"; }
