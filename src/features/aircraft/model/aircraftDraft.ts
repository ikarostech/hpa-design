import type { AircraftGeometry, TailSurface, WingSection } from "./types";
import { validateTailSurface } from "./tailGeometry";
import { deriveWingGeometry, validateWingSections } from "./wingGeometry";

export interface AircraftDraft {
  incidence: number;
  staticMargin: number;
  sections: WingSection[];
  tailSurfaces: TailSurface[];
}

export type AircraftDraftValidation =
  | { valid: true; errors: {} }
  | { valid: false; errors: Partial<Record<"incidence" | "staticMargin", string>> & { sections?: readonly string[]; tailSurfaces?: readonly string[] } };

export function createAircraftDraft(aircraft: AircraftGeometry): AircraftDraft {
  return {
    incidence: aircraft.incidence,
    staticMargin: aircraft.staticMargin,
    sections: aircraft.sections.map((section) => ({ ...section })),
    tailSurfaces: (aircraft.tailSurfaces ?? []).map(cloneTailSurface),
  };
}

export function validateAircraftDraft(draft: AircraftDraft, airfoilIds: ReadonlySet<string>): AircraftDraftValidation {
  const errors: Partial<Record<"incidence" | "staticMargin", string>> & { sections?: string[]; tailSurfaces?: string[] } = {};
  for (const field of ["incidence", "staticMargin"] as const) {
    if (!Number.isFinite(draft[field])) errors[field] = "Must be a finite number.";
  }

  const sectionErrors = validateWingSections(draft.sections, airfoilIds);
  if (sectionErrors.length) errors.sections = sectionErrors;
  const tailIds = new Set<string>();
  const tailErrors = draft.tailSurfaces.flatMap((surface, index) => {
    const surfaceErrors = validateTailSurface(surface, airfoilIds).map((error) => `Tail ${index + 1}: ${error}`);
    if (tailIds.has(surface.id)) surfaceErrors.push(`Tail ${index + 1}: ID must be unique.`);
    tailIds.add(surface.id);
    return surfaceErrors;
  });
  if (tailErrors.length) errors.tailSurfaces = tailErrors;
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
    tailSurfaces: draft.tailSurfaces.map((surface) => cloneTailSurface({
      ...surface,
      sections: [...surface.sections].sort((left, right) => left.spanPosition - right.spanPosition),
    })),
  };
}

function cloneTailSurface(surface: TailSurface): TailSurface {
  return {
    ...surface,
    rootPosition: { ...surface.rootPosition },
    sections: surface.sections.map((section) => ({ ...section })),
  };
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
