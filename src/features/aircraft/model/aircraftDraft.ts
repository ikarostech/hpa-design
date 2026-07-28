import type { AircraftGeometry, WingSection } from "./types";
import { deriveWingGeometry, validateWingSections } from "./wingGeometry";

export interface AircraftDraft {
  incidence: number;
  staticMargin: number;
  sections: WingSection[];
}

export type AircraftDraftValidation =
  | { valid: true; errors: {} }
  | { valid: false; errors: Partial<Record<"incidence" | "staticMargin", string>> & { sections?: readonly string[] } };

export function createAircraftDraft(aircraft: AircraftGeometry): AircraftDraft {
  return {
    incidence: aircraft.incidence,
    staticMargin: aircraft.staticMargin,
    sections: aircraft.sections.map((section) => ({ ...section })),
  };
}

export function validateAircraftDraft(draft: AircraftDraft, airfoilIds: ReadonlySet<string>): AircraftDraftValidation {
  const errors: Partial<Record<"incidence" | "staticMargin", string>> & { sections?: string[] } = {};
  for (const field of ["incidence", "staticMargin"] as const) {
    if (!Number.isFinite(draft[field])) errors[field] = "Must be a finite number.";
  }

  const sectionErrors = validateWingSections(draft.sections, airfoilIds);
  if (sectionErrors.length) errors.sections = sectionErrors;
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, errors: {} };
}

export function applyAircraftDraft(draft: AircraftDraft, aircraft: AircraftGeometry): AircraftGeometry {
  const sections = [...draft.sections]
    .sort((left, right) => left.yPosition - right.yPosition)
    .map((section) => ({ ...section }));
  const metrics = deriveWingGeometry(sections);
  return {
    ...aircraft,
    incidence: draft.incidence,
    staticMargin: draft.staticMargin,
    span: round(metrics.span, 3),
    rootChord: round(metrics.rootChord, 3),
    tipChord: round(metrics.tipChord, 3),
    taperRatio: round(metrics.taperRatio, 3),
    twist: round(metrics.twist, 3),
    dihedral: round(metrics.dihedral, 3),
    sweep: round(metrics.sweep, 3),
    wingArea: round(metrics.wingArea, 3),
    aspectRatio: round(metrics.aspectRatio, 3),
    mac: round(metrics.mac, 3),
    sections,
  };
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
