export const DEFAULT_SPAR_CHORD_FRACTION = 0.25;
export const DEFAULT_WING_SPAR_CHORD_FRACTION = 0.35;

export function isValidSparChordFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function alignSectionsToStraightSpar<T extends { chord: number; xOffset: number }>(sections: readonly T[], fraction: number): T[] {
  if (!isValidSparChordFraction(fraction)) throw new Error("Spar chord fraction must be between 0 and 1.");
  if (!sections.length) return [];
  const root = sections[0];
  return sections.map((section) => ({
    ...section,
    xOffset: Number((root.xOffset + fraction * (root.chord - section.chord)).toFixed(6)),
  }));
}
