export interface ConceptualDesign {
  grossMass: number;
  cruiseSpeed: number;
  maximumWingspan: number;
  groundHeight: number;
  sustainablePower: number;
}

export interface ConceptualDesignMetrics {
  airDensity: number;
  weight: number;
  dynamicPressure: number;
  heightToSpanRatio: number;
  wingLoading: number;
  requiredLiftCoefficient: number;
  wingspanMargin: number;
  powerLoading: number;
}

export type ConceptualDesignValidation =
  | { valid: true; errors: Record<string, never> }
  | { valid: false; errors: Partial<Record<keyof ConceptualDesign, string>> };

export const conceptualDesignConditions = {
  altitude: 0,
  temperature: 30,
  loadFactor: 1,
  safetyFactor: 1.5,
} as const;

const standardSeaLevelPressure = 101_325;
const dryAirGasConstant = 287.05287;
const gravitationalAcceleration = 9.80665;

export function createDefaultConceptualDesign(): ConceptualDesign {
  return {
    grossMass: 100,
    cruiseSpeed: 8,
    maximumWingspan: 30,
    groundHeight: 1,
    sustainablePower: 250,
  };
}

export function validateConceptualDesign(design: ConceptualDesign): ConceptualDesignValidation {
  const errors: Partial<Record<keyof ConceptualDesign, string>> = {};
  for (const field of Object.keys(design) as Array<keyof ConceptualDesign>) {
    if (!Number.isFinite(design[field]) || design[field] <= 0) errors[field] = "0より大きい有限の値を入力してください。";
  }
  return Object.keys(errors).length ? { valid: false, errors } : { valid: true, errors: {} };
}

export function calculateConceptualDesignMetrics(
  design: ConceptualDesign,
  aircraft: { span: number; wingArea: number },
): ConceptualDesignMetrics {
  const temperatureKelvin = conceptualDesignConditions.temperature + 273.15;
  const airDensity = standardSeaLevelPressure / (dryAirGasConstant * temperatureKelvin);
  const weight = design.grossMass * gravitationalAcceleration;
  const dynamicPressure = airDensity * design.cruiseSpeed ** 2 / 2;
  return {
    airDensity,
    weight,
    dynamicPressure,
    heightToSpanRatio: design.groundHeight / aircraft.span,
    wingLoading: weight / aircraft.wingArea,
    requiredLiftCoefficient: weight / (dynamicPressure * aircraft.wingArea),
    wingspanMargin: design.maximumWingspan - aircraft.span,
    powerLoading: weight / design.sustainablePower,
  };
}
