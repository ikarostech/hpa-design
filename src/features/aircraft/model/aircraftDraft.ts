import type { AircraftGeometry, WingSection } from "./types";

export type AircraftDraft = Pick<AircraftGeometry, "span" | "rootChord" | "tipChord" | "twist" | "dihedral" | "sweep" | "incidence" | "staticMargin"> & {
  sections: WingSection[];
};

export type AircraftDraftValidation =
  | { valid: true; errors: {} }
  | { valid: false; errors: Partial<Record<Exclude<keyof AircraftDraft, "sections">, string>> & { sections?: readonly string[] } };

export function createAircraftDraft(aircraft: AircraftGeometry): AircraftDraft {
  return {
    span: aircraft.span,
    rootChord: aircraft.rootChord,
    tipChord: aircraft.tipChord,
    twist: aircraft.twist,
    dihedral: aircraft.dihedral,
    sweep: aircraft.sweep,
    incidence: aircraft.incidence,
    staticMargin: aircraft.staticMargin,
    sections: aircraft.sections.map((section) => ({ ...section })),
  };
}

export function validateAircraftDraft(draft: AircraftDraft, airfoilIds: ReadonlySet<string>): AircraftDraftValidation {
  const errors: Partial<Record<Exclude<keyof AircraftDraft, "sections">, string>> & { sections?: string[] } = {};
  for (const field of ["span", "rootChord", "tipChord"] as const) {
    if (!Number.isFinite(draft[field]) || draft[field] <= 0) errors[field] = "Must be a positive number.";
  }
  for (const field of ["twist", "dihedral", "sweep", "incidence", "staticMargin"] as const) {
    if (!Number.isFinite(draft[field])) errors[field] = "Must be a finite number.";
  }

  const sectionErrors = validateSections(draft.sections, draft.span, airfoilIds);
  if (sectionErrors.length) errors.sections = sectionErrors;
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, errors: {} };
}

export function applyAircraftDraft(draft: AircraftDraft, aircraft: AircraftGeometry): AircraftGeometry {
  const sections = draft.sections.map((section) => ({ ...section }));
  const metrics = deriveSectionMetrics(sections, draft.span, draft.rootChord, draft.tipChord);
  return {
    ...aircraft,
    ...draft,
    rootChord: metrics.rootChord,
    tipChord: metrics.tipChord,
    taperRatio: round(safeDivide(metrics.tipChord, metrics.rootChord), 3),
    wingArea: round(metrics.wingArea, 3),
    aspectRatio: round(safeDivide(draft.span ** 2, metrics.wingArea), 3),
    mac: round(metrics.mac, 3),
    sections,
  };
}

function validateSections(sections: readonly WingSection[], span: number, airfoilIds: ReadonlySet<string>) {
  const errors: string[] = [];
  if (sections.length < 2) {
    errors.push("At least two wing sections are required.");
    return errors;
  }

  const ids = new Set<string>();
  let previousPosition = Number.NEGATIVE_INFINITY;
  const halfSpan = span / 2;
  sections.forEach((section, index) => {
    const label = `Section ${index + 1}`;
    if (!section.id || ids.has(section.id)) errors.push(`${label}: ID must be unique.`);
    ids.add(section.id);
    if (!Number.isFinite(section.spanPosition) || section.spanPosition < 0 || section.spanPosition > halfSpan) errors.push(`${label}: span position must be within the half span.`);
    if (section.spanPosition <= previousPosition) errors.push(`${label}: span position must increase from root to tip.`);
    previousPosition = section.spanPosition;
    if (!Number.isFinite(section.chord) || section.chord <= 0) errors.push(`${label}: chord must be a positive number.`);
    if (!Number.isFinite(section.twist) || !Number.isFinite(section.dihedral)) errors.push(`${label}: angles must be finite numbers.`);
    if (!airfoilIds.has(section.airfoilId)) errors.push(`${label}: select an existing airfoil.`);
  });
  return errors;
}

function deriveSectionMetrics(sections: readonly WingSection[], span: number, fallbackRootChord: number, fallbackTipChord: number) {
  if (sections.length < 2) {
    const wingArea = span * (fallbackRootChord + fallbackTipChord) / 2;
    return { rootChord: fallbackRootChord, tipChord: fallbackTipChord, wingArea, mac: fallbackRootChord > 0 ? (2 / 3) * fallbackRootChord * (1 + safeDivide(fallbackTipChord, fallbackRootChord) + safeDivide(fallbackTipChord, fallbackRootChord) ** 2) / (1 + safeDivide(fallbackTipChord, fallbackRootChord)) : 0 };
  }

  const sorted = [...sections].sort((left, right) => left.spanPosition - right.spanPosition);
  let halfWingArea = 0;
  let chordSquareIntegral = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const root = sorted[index - 1];
    const tip = sorted[index];
    const length = tip.spanPosition - root.spanPosition;
    halfWingArea += length * (root.chord + tip.chord) / 2;
    chordSquareIntegral += length * (root.chord ** 2 + root.chord * tip.chord + tip.chord ** 2) / 3;
  }

  return {
    rootChord: sorted[0].chord,
    tipChord: sorted[sorted.length - 1].chord,
    wingArea: halfWingArea * 2,
    mac: safeDivide(chordSquareIntegral, halfWingArea),
  };
}

function safeDivide(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}
