import sampleProject from "../../examples/HPADesign-Aero-Structural-MVP.json";
import { createDefaultConceptualDesign } from "../features/conceptual-design/model/conceptualDesign";
import type { DesignDocument } from "./designDocument";

export function createDefaultDesignDocument(): DesignDocument {
  return {
    ...(JSON.parse(JSON.stringify(sampleProject)) as DesignDocument),
    conceptualDesign: createDefaultConceptualDesign(),
  };
}
