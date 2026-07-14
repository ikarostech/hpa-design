import type { ValidationIssue } from "@/shared/model";
import { createAirfoilFromDat, createNaca4Airfoil, parseAirfoilDat, validateAirfoilDat } from "../model/airfoilGeometry";
import type { Airfoil } from "../model/types";

export type DatAirfoilPreview =
  | {
    valid: true;
    airfoil: Airfoil;
    format: "selig" | "lednicer";
    pointCount: number;
    suggestedName: string;
    issues: readonly ValidationIssue[];
  }
  | {
    valid: false;
    error: string;
    issues: readonly ValidationIssue[];
  };

export type NacaAirfoilPreview =
  | { valid: true; airfoil: Airfoil }
  | { valid: false; error: string };

export function createDatAirfoilPreview({ datText, id, name }: { datText: string; id: string; name: string }): DatAirfoilPreview {
  try {
    const imported = parseAirfoilDat(datText);
    const validation = validateAirfoilDat(imported);
    const issues = validation.issues ?? [];
    if (!validation.valid) {
      return { valid: false, error: issues.map((issue) => issue.message).join(" "), issues };
    }

    return {
      valid: true,
      airfoil: createAirfoilFromDat(imported, id, name),
      format: imported.format,
      pointCount: imported.coordinates.length,
      suggestedName: imported.name,
      issues,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "座標を読み込めませんでした。",
      issues: [],
    };
  }
}

export function createNacaAirfoilPreview(code: string, id: string): NacaAirfoilPreview {
  try {
    return { valid: true, airfoil: createNaca4Airfoil(code, id) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "NACA翼型を生成できませんでした。" };
  }
}

export async function readAirfoilDatFile(file: File) {
  return file.text();
}
