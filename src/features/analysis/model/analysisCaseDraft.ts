import type { AnalysisCase, AnalysisMethod } from "./types";

export type AnalysisCaseDraft = Omit<AnalysisCase, "id" | "status">;

export type AnalysisCaseDraftValidation =
  | { valid: true; errors: {} }
  | { valid: false; errors: Partial<Record<keyof AnalysisCaseDraft, string>> };

export function createAnalysisCaseDraft(analysisCase: AnalysisCase): AnalysisCaseDraft {
  const { id: _id, status: _status, ...draft } = analysisCase;
  return { ...draft };
}

export function validateAnalysisCaseDraft(
  draft: AnalysisCaseDraft,
  geometryIds: ReadonlySet<string>,
): AnalysisCaseDraftValidation {
  const errors: Partial<Record<keyof AnalysisCaseDraft, string>> = {};
  if (!draft.name.trim()) errors.name = "Enter a case name.";
  if (!isAnalysisMethod(draft.method)) errors.method = "Choose LLT or VLM.";
  if (!Number.isFinite(draft.alphaStart)) errors.alphaStart = "Enter a finite start angle.";
  if (!Number.isFinite(draft.alphaEnd) || draft.alphaEnd < draft.alphaStart) errors.alphaEnd = "End angle must be at least the start angle.";
  if (!Number.isFinite(draft.alphaStep) || draft.alphaStep <= 0) errors.alphaStep = "Angle step must be positive.";
  if (!Number.isFinite(draft.speed) || draft.speed <= 0) errors.speed = "Speed must be positive.";
  if (!Number.isFinite(draft.altitude) || draft.altitude < 0) errors.altitude = "Altitude cannot be negative.";
  if (!Number.isFinite(draft.reynolds) || draft.reynolds <= 0) errors.reynolds = "Reynolds number must be positive.";
  if (!geometryIds.has(draft.geometryId)) errors.geometryId = "Select an available aircraft geometry.";
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, errors: {} };
}

export function createAnalysisCase(id: string, draft: AnalysisCaseDraft): AnalysisCase {
  return { id, ...draft, name: draft.name.trim(), status: "not-run" };
}

export function updateAnalysisCase(current: AnalysisCase, draft: AnalysisCaseDraft): AnalysisCase {
  const next = { ...current, ...draft, name: draft.name.trim() };
  return hasAnalysisInputsChanged(current, next) ? { ...next, status: "needs-review" } : next;
}

function hasAnalysisInputsChanged(left: AnalysisCase, right: AnalysisCase) {
  return (Object.keys(createAnalysisCaseDraft(left)) as Array<keyof AnalysisCaseDraft>)
    .some((key) => left[key] !== right[key]);
}

function isAnalysisMethod(method: string): method is AnalysisMethod {
  return method === "LLT" || method === "VLM";
}
