import type { Exporter } from "../../../shared/model";
import type { AnalysisResult } from "../model/types";

export interface AnalysisResultExportInput {
  designName: string;
  results: readonly AnalysisResult[];
  selectedResultIds: readonly string[];
}

export interface AnalysisResultExportFile {
  fileName: string;
  mimeType: string;
  content: string;
}

export interface DesignSummaryInput {
  name: string;
  analysisCases: readonly { id: string; name: string; status: string }[];
  analysisResults: readonly AnalysisResult[];
}

export const analysisResultExporter: Exporter<AnalysisResultExportInput, AnalysisResultExportFile> & {
  exportJson: (input: AnalysisResultExportInput) => Promise<AnalysisResultExportFile>;
} = {
  export: async (input) => ({
    fileName: `${fileStem(input.designName)}-analysis-results.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: createAnalysisCsv(selectResults(input)),
  }),
  exportJson: async (input) => ({
    fileName: `${fileStem(input.designName)}-analysis-results.json`,
    mimeType: "application/json;charset=utf-8",
    content: JSON.stringify(selectResults(input), null, 2),
  }),
};

function createAnalysisCsv(results: readonly AnalysisResult[]) {
  const polarRows = results.flatMap((result) => result.rows.map((row) => [
      row.caseId,
      result.id,
      row.status,
      formatAnalysisNumber(row.alpha, 1),
      formatAnalysisNumber(row.cl, 4),
      formatAnalysisNumber(row.cd, 6),
      formatAnalysisNumber(row.cm, 4),
      formatAnalysisNumber(row.ld, 2),
    ].map(escapeCsv).join(",")));
  const spanRows = results.flatMap((result) => result.rows.flatMap((row) => row.spanwise?.samples.map((sample) => [
    result.id, row.caseId, formatAnalysisNumber(row.alpha, 1), sample.position,
    sample.values.stationWidth, sample.values.chord, sample.values.circulation, sample.values.localLiftCoefficient,
    sample.values.liftPerLength, sample.values.inducedDragPerLength, sample.values.profileDragPerLength, sample.values.dragPerLength,
    sample.values.pitchingMomentPerLength, sample.values.torqueAboutElasticAxisPerLength,
  ].map(String).map(escapeCsv).join(",")) ?? []));
  const polarSection = `\uFEFFcase_id,result_id,status,alpha_deg,cl,cd,cm,ld\r\n${polarRows.join("\r\n")}${polarRows.length ? "\r\n" : ""}`;
  if (!spanRows.length) return polarSection;
  return `${polarSection}\r\n[spanwise]\r\nresult_id,case_id,alpha_deg,y_m,width_m,chord_m,circulation_m2_per_s,local_cl,lift_N_per_m,induced_drag_N_per_m,profile_drag_N_per_m,drag_N_per_m,pitching_moment_Nm_per_m,elastic_axis_torque_Nm_per_m\r\n${spanRows.join("\r\n")}\r\n`;
}

export function createDesignSummary({ name, analysisCases, analysisResults }: DesignSummaryInput) {
  const caseLines = analysisCases.map((analysisCase) => {
    const result = analysisResults.find((item) => item.caseId === analysisCase.id);
    return result
      ? `- ${analysisCase.name}: CLmax ${formatAnalysisNumber(result.clMax, 3)} / 最大 L/D ${formatAnalysisNumber(result.maxLD, 2)} (${result.status})`
      : `- ${analysisCase.name}: 結果なし (${analysisCase.status})`;
  });
  return [`# ${name} 設計サマリー`, "", `解析ケース: ${analysisCases.length}`, `保存済み結果: ${analysisResults.length}`, "", "## 解析結果", ...caseLines].join("\n");
}

function selectResults(input: AnalysisResultExportInput) {
  const selectedIds = new Set(input.selectedResultIds);
  return input.results.filter((result) => selectedIds.has(result.id));
}

function fileStem(name: string) {
  return name.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "") || "hpa-design";
}

export function formatAnalysisNumber(value: number, digits: number) {
  const factor = 10 ** digits;
  return (Math.round((value + Number.EPSILON) * factor) / factor).toFixed(digits);
}

function escapeCsv(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}
