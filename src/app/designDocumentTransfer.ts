import type { Exporter, Importer, ValidationIssue, ValidationResult } from "../shared/model/transfer";
import type { DesignDocument } from "./designDocument";

type JsonRecord = Record<string, unknown>;

export const designDocumentImporter: Importer<string, DesignDocument> = {
  parse: async (input) => parseDesignDocument(input),
  validate: (document) => validateDesignDocument(document),
};

export const designDocumentExporter: Exporter<DesignDocument, string> = {
  export: async (document) => JSON.stringify(document, preserveInfiniteNumber, 2),
};

export function formatValidationIssues(issues: readonly ValidationIssue[]) {
  return issues.map((issue) => `${issue.path?.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`).join("\n");
}

export function validateDesignDocument(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(document)) {
    return invalid([{ message: "設計ファイルの先頭はオブジェクトである必要があります。", severity: "error" }]);
  }

  validateSchemaVersion(document, issues);
  validateNonEmptyString(document.name, ["name"], issues);
  validateConceptualDesign(document.conceptualDesign, issues);
  const arrays = validateRequiredArrays(document, issues);
  const aircraft = validateAircraft(document.aircraft, issues);

  const airfoilIds = validateAirfoils(arrays.airfoils, issues);
  validateWingSections(aircraft?.sections ?? [], airfoilIds, issues);
  const polarIds = validatePolars(arrays.polars, airfoilIds, issues);
  validateAnalysisRuns(arrays.airfoilAnalysisRuns, airfoilIds, polarIds, issues);
  const caseIds = validateAnalysisCases(arrays.analysisCases, aircraft?.id, issues);
  validateAnalysisResults(arrays.analysisResults, caseIds, issues);
  const materialIds = validateCarbonMaterials(arrays.carbonMaterials, issues);
  const structuralDesignIds = validateStructuralDesigns(arrays.structuralDesigns, materialIds, issues);
  validateStructuralResults(arrays.structuralResults, structuralDesignIds, materialIds, issues);
  validateAeroelasticResults(arrays.aeroelasticResults, structuralDesignIds, materialIds, aircraft?.id, issues);

  return issues.length ? invalid(issues) : { valid: true };
}

function validateConceptualDesign(value: unknown, issues: ValidationIssue[]) {
  if (value === undefined) return;
  const path = ["conceptualDesign"];
  if (!isRecord(value)) {
    addIssue(issues, path, "概要設計はオブジェクトである必要があります。");
    return;
  }
  for (const field of ["grossMass", "cruiseSpeed", "maximumWingspan", "groundHeight", "sustainablePower"]) {
    const number = validateFiniteNumber(value[field], [...path, field], issues);
    if (number !== null && number <= 0) addIssue(issues, [...path, field], "0より大きい値が必要です。");
  }
}

export function parseDesignDocument(input: string): DesignDocument {
  try {
    return migrateDesignDocument(JSON.parse(input, restoreInfiniteNumber)) as DesignDocument;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`設計ファイルを JSON として読み込めません: ${error.message}`);
    }
    throw error;
  }
}

const infiniteNumberTag = "$hpaNumber";

function preserveInfiniteNumber(_key: string, value: unknown) {
  if (value === Number.POSITIVE_INFINITY) return { [infiniteNumberTag]: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { [infiniteNumberTag]: "-Infinity" };
  return value;
}

function restoreInfiniteNumber(_key: string, value: unknown) {
  if (!isRecord(value) || Object.keys(value).length !== 1) return value;
  if (value[infiniteNumberTag] === "Infinity") return Number.POSITIVE_INFINITY;
  if (value[infiniteNumberTag] === "-Infinity") return Number.NEGATIVE_INFINITY;
  return value;
}

export function migrateDesignDocument(document: unknown): unknown {
  if (!isRecord(document)) return document;

  switch (document.schemaVersion) {
    case 1: {
      const aircraft = isRecord(document.aircraft) ? document.aircraft : null;
      const sweep = aircraft && typeof aircraft.sweep === "number" ? aircraft.sweep : 0;
      const sections = aircraft && Array.isArray(aircraft.sections)
        ? aircraft.sections.map((section) => migrateVersion1WingSection(section, sweep))
        : aircraft?.sections;
      return migrateDesignDocument({
        ...document,
        schemaVersion: 2,
        aircraft: aircraft ? { ...aircraft, sections } : document.aircraft,
      });
    }
    case 2:
      return migrateDesignDocument({
        ...document,
        schemaVersion: 3,
        carbonMaterials: [],
        structuralDesigns: [],
        structuralResults: [],
      });
    case 3:
      return migrateDesignDocument({
        ...document,
        schemaVersion: 4,
        structuralDesigns: Array.isArray(document.structuralDesigns) ? document.structuralDesigns.map(migrateVersion3StructuralDesign) : document.structuralDesigns,
        structuralResults: Array.isArray(document.structuralResults) ? document.structuralResults.map(migrateVersion3StructuralResult) : document.structuralResults,
      });
    case 4:
      return {
        ...document,
        schemaVersion: 5,
        structuralResults: mapLegacyArray(document.structuralResults, migrateRadiansInStructuralResult),
        aeroelasticResults: mapLegacyArray(document.aeroelasticResults, migrateRadiansInAeroelasticResult),
      };
    case 5:
      return document;
    default:
      return document;
  }
}

function mapLegacyArray(value: unknown, migrate: (item: unknown) => unknown): unknown {
  return Array.isArray(value) ? value.map(migrate) : value;
}

function degreesFromLegacyRadians(value: unknown): unknown {
  return typeof value === "number" ? value * 180 / Math.PI : value;
}

function migrateAngleFields(value: unknown, fields: readonly string[]): unknown {
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, fields.includes(key) ? degreesFromLegacyRadians(item) : item,
  ]));
}

function migrateRadiansInStructuralResult(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    points: mapLegacyArray(value.points, (point) => migrateAngleFields(point, ["rotation", "twist"])),
    summary: migrateAngleFields(value.summary, ["maxTwist"]),
  };
}

function migrateRadiansInMesh(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return { ...value, strips: mapLegacyArray(value.strips, (strip) => migrateAngleFields(strip, ["dihedral", "quarterChordSweep"])) };
}

function migrateRadiansInAeroelasticResult(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    structuralResult: migrateRadiansInStructuralResult(value.structuralResult),
    iterations: mapLegacyArray(value.iterations, (iteration) => migrateAngleFields(iteration, ["maxTwist"])),
    undeformedMesh: migrateRadiansInMesh(value.undeformedMesh),
    deformedMesh: migrateRadiansInMesh(value.deformedMesh),
  };
}

function validateSchemaVersion(document: JsonRecord, issues: ValidationIssue[]) {
  if (document.schemaVersion !== 5) {
    addIssue(issues, ["schemaVersion"], "対応していない設計ファイルのバージョンです。");
  }
}

function validateRequiredArrays(document: JsonRecord, issues: ValidationIssue[]) {
  return {
    airfoils: readArray(document.airfoils, ["airfoils"], issues),
    polars: readArray(document.polars, ["polars"], issues),
    airfoilAnalysisRuns: readArray(document.airfoilAnalysisRuns, ["airfoilAnalysisRuns"], issues),
    analysisCases: readArray(document.analysisCases, ["analysisCases"], issues),
    analysisResults: readArray(document.analysisResults, ["analysisResults"], issues),
    carbonMaterials: readArray(document.carbonMaterials, ["carbonMaterials"], issues),
    structuralDesigns: readArray(document.structuralDesigns, ["structuralDesigns"], issues),
    structuralResults: readArray(document.structuralResults, ["structuralResults"], issues),
    aeroelasticResults: document.aeroelasticResults === undefined ? [] : readArray(document.aeroelasticResults, ["aeroelasticResults"], issues),
  };
}

function validateCarbonMaterials(items: readonly unknown[], issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["carbonMaterials", String(index)];
    if (!isRecord(item)) { addIssue(issues, path, "材料はオブジェクトである必要があります。"); return; }
    addUniqueId(item.id, path, ids, issues);
    validateNonEmptyString(item.name, [...path, "name"], issues);
    for (const field of ["e1", "e2", "g12", "nu12", "tensileStrength1", "compressiveStrength1", "tensileStrength2", "compressiveStrength2", "shearStrength12", "density", "plyThickness", "reductionFactor"]) {
      const value = validateFiniteNumber(item[field], [...path, field], issues);
      if (value !== null && value <= 0) addIssue(issues, [...path, field], "0より大きい値が必要です。");
    }
  });
  return ids;
}

function validateStructuralDesigns(items: readonly unknown[], materialIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["structuralDesigns", String(index)];
    if (!isRecord(item)) { addIssue(issues, path, "構造設計はオブジェクトである必要があります。"); return; }
    addUniqueId(item.id, path, ids, issues);
    validateNonEmptyString(item.name, [...path, "name"], issues);
    const sections = readArray(item.sections, [...path, "sections"], issues);
    if (!sections.length) addIssue(issues, [...path, "sections"], "パイプセクションは1つ以上必要です。");
    sections.forEach((section, sectionIndex) => {
      const sectionPath = [...path, "sections", String(sectionIndex)];
      if (!isRecord(section)) { addIssue(issues, sectionPath, "パイプセクションはオブジェクトである必要があります。"); return; }
      validateNonEmptyString(section.id, [...sectionPath, "id"], issues);
      const length = validateFiniteNumber(section.length, [...sectionPath, "length"], issues);
      if (length !== null && length <= 0) addIssue(issues, [...sectionPath, "length"], "セクション長さは0より大きい必要があります。");
      const diameter = validateFiniteNumber(section.outerDiameter, [...sectionPath, "outerDiameter"], issues);
      if (diameter !== null && diameter <= 0) addIssue(issues, [...sectionPath, "outerDiameter"], "外径は0より大きい必要があります。");
      readArray(section.plies, [...sectionPath, "plies"], issues).forEach((ply, plyIndex) => {
        const plyPath = [...sectionPath, "plies", String(plyIndex)];
        if (!isRecord(ply)) { addIssue(issues, plyPath, "積層はオブジェクトである必要があります。"); return; }
        validateReference(ply.materialId, [...plyPath, "materialId"], materialIds, "カーボン材料", issues);
        if (typeof ply.angle !== "number" || ![0, 45, -45, 90].includes(ply.angle)) addIssue(issues, [...plyPath, "angle"], "積層角は0、45、-45、90のいずれかが必要です。");
        if (typeof ply.count !== "number" || !Number.isInteger(ply.count) || ply.count < 1) addIssue(issues, [...plyPath, "count"], "層数は1以上の整数が必要です。");
        if (ply.partialAngle !== undefined) {
          const partialAngle = validateFiniteNumber(ply.partialAngle, [...plyPath, "partialAngle"], issues);
          if (partialAngle !== null && (partialAngle <= 0 || partialAngle > 90)) addIssue(issues, [...plyPath, "partialAngle"], "上下部分積層角度は0より大きく90以下が必要です。");
        }
        if (ply.partialWidth !== undefined) {
          const partialWidth = validateFiniteNumber(ply.partialWidth, [...plyPath, "partialWidth"], issues);
          if (partialWidth !== null && partialWidth <= 0) addIssue(issues, [...plyPath, "partialWidth"], "上下幅は0より大きい値が必要です。");
        }
      });
    });
    readArray(item.loadCases, [...path, "loadCases"], issues).forEach((loadCase, loadIndex) => validateStructuralLoadCase(loadCase, [...path, "loadCases", String(loadIndex)], issues));
  });
  return ids;
}

function migrateVersion3StructuralDesign(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.stations)) return value;
  const stations = value.stations.filter(isRecord).sort((left, right) => numericValue(left.yPosition) - numericValue(right.yPosition));
  const sections = stations.map((station, index) => {
    const position = numericValue(station.yPosition);
    const start = index === 0 ? position : (numericValue(stations[index - 1].yPosition) + position) / 2;
    const end = index === stations.length - 1 ? position : (position + numericValue(stations[index + 1].yPosition)) / 2;
    const { yPosition: _yPosition, ...section } = station;
    return { ...section, length: Number((end - start).toFixed(12)) };
  });
  const { stations: _stations, ...design } = value;
  return { ...design, sections };
}

function migrateVersion3StructuralResult(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return { ...value, designSnapshot: migrateVersion3StructuralDesign(value.designSnapshot) };
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function validateStructuralLoadCase(value: unknown, path: string[], issues: ValidationIssue[]) {
  if (!isRecord(value)) { addIssue(issues, path, "構造荷重ケースはオブジェクトである必要があります。"); return; }
  validateNonEmptyString(value.id, [...path, "id"], issues);
  validateNonEmptyString(value.name, [...path, "name"], issues);
  validateEnum(value.source, [...path, "source"], ["aerodynamic", "elliptical", "manual"], issues);
  validateEnum(value.status, [...path, "status"], ["completed", "not-run", "needs-review"], issues);
  validateFiniteNumber(value.loadFactor, [...path, "loadFactor"], issues);
  validateFiniteNumber(value.safetyFactor, [...path, "safetyFactor"], issues);
  readArray(value.distributedLoads, [...path, "distributedLoads"], issues);
  readArray(value.pointLoads, [...path, "pointLoads"], issues);
}

function validateStructuralResults(items: readonly unknown[], designIds: ReadonlySet<string>, materialIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["structuralResults", String(index)];
    if (!isRecord(item)) { addIssue(issues, path, "構造解析結果はオブジェクトである必要があります。"); return; }
    addUniqueId(item.id, path, ids, issues);
    validateReference(item.designId, [...path, "designId"], designIds, "構造設計", issues);
    validateReferenceList(item.materialIds, [...path, "materialIds"], materialIds, "カーボン材料", issues);
    validateEnum(item.status, [...path, "status"], ["completed", "not-run", "needs-review"], issues);
    validateDate(item.createdAt, [...path, "createdAt"], issues);
    readArray(item.points, [...path, "points"], issues);
  });
}

function validateAeroelasticResults(
  items: readonly unknown[],
  designIds: ReadonlySet<string>,
  materialIds: ReadonlySet<string>,
  aircraftId: string | null | undefined,
  issues: ValidationIssue[],
) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["aeroelasticResults", String(index)];
    if (!isRecord(item)) { addIssue(issues, path, "空力構造連成結果はオブジェクトである必要があります。"); return; }
    addUniqueId(item.id, path, ids, issues);
    validateReference(item.structuralDesignId, [...path, "structuralDesignId"], designIds, "構造設計", issues);
    validateReferenceList(item.materialIds, [...path, "materialIds"], materialIds, "カーボン材料", issues);
    validateEnum(item.status, [...path, "status"], ["converged", "max-iterations", "diverged"], issues);
    validateEnum(item.reviewStatus, [...path, "reviewStatus"], ["current", "needs-review"], issues);
    validateDate(item.createdAt, [...path, "createdAt"], issues);
    for (const field of ["density", "speed", "elasticAxisChordFraction", "alphaDegrees", "cl", "cdi", "cm", "totalLift"]) validateFiniteNumber(item[field], [...path, field], issues);
    readArray(item.materialIds, [...path, "materialIds"], issues);
    readArray(item.spanLoads, [...path, "spanLoads"], issues);
    readArray(item.iterations, [...path, "iterations"], issues);
    readArray(item.warnings, [...path, "warnings"], issues);
    if (!isRecord(item.aircraftSnapshot)) addIssue(issues, [...path, "aircraftSnapshot"], "機体スナップショットが必要です。");
    else if (aircraftId && item.aircraftSnapshot.id !== aircraftId) addIssue(issues, [...path, "aircraftSnapshot", "id"], "現在の設計に存在しない機体を参照しています。");
    if (!isRecord(item.structuralResult)) addIssue(issues, [...path, "structuralResult"], "構造解析結果が必要です。");
    if (!isRecord(item.undeformedMesh) || !isRecord(item.deformedMesh)) addIssue(issues, [...path, "deformedMesh"], "変形前後の空力メッシュが必要です。");
  });
}

function validateAirfoils(items: readonly unknown[], issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["airfoils", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "翼型はオブジェクトである必要があります。");
      return;
    }

    addUniqueId(item.id, path, ids, issues);
    validateNonEmptyString(item.name, [...path, "name"], issues);
    for (const field of ["thicknessRatio", "maxCamber", "leadingEdgeRadius", "trailingEdgeThickness"]) {
      validateFiniteNumber(item[field], [...path, field], issues);
    }

    const coordinates = readArray(item.coordinates, [...path, "coordinates"], issues);
    if (coordinates.length < 3) {
      addIssue(issues, [...path, "coordinates"], "翼型座標は3点以上必要です。");
    }
    let previousX = Number.NEGATIVE_INFINITY;
    coordinates.forEach((coordinate, coordinateIndex) => {
      const coordinatePath = [...path, "coordinates", String(coordinateIndex)];
      if (!isRecord(coordinate)) {
        addIssue(issues, coordinatePath, "翼型座標はオブジェクトである必要があります。");
        return;
      }
      const x = validateFiniteNumber(coordinate.x, [...coordinatePath, "x"], issues);
      const upper = validateFiniteNumber(coordinate.upper, [...coordinatePath, "upper"], issues);
      const lower = validateFiniteNumber(coordinate.lower, [...coordinatePath, "lower"], issues);
      if (x !== null && (x < 0 || x > 1)) addIssue(issues, [...coordinatePath, "x"], "翼型座標 x は 0 から 1 の範囲である必要があります。");
      if (x !== null && x < previousX) addIssue(issues, [...coordinatePath, "x"], "翼型座標 x は昇順である必要があります。");
      if (x !== null) previousX = x;
      if (upper !== null && lower !== null && upper < lower) addIssue(issues, coordinatePath, "翼型の上面座標は下面座標以上である必要があります。");
    });
  });
  return ids;
}

function validatePolars(items: readonly unknown[], airfoilIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["polars", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "Polar はオブジェクトである必要があります。");
      return;
    }
    addUniqueId(item.id, path, ids, issues);
    validateReference(item.airfoilId, [...path, "airfoilId"], airfoilIds, "翼型", issues);
    validateNonEmptyString(item.caseName, [...path, "caseName"], issues);
    for (const field of ["reynolds", "mach", "alphaStart", "alphaEnd", "alphaStep", "ncrit", "convergedPoints", "requestedPoints"]) {
      validateFiniteNumber(item[field], [...path, field], issues);
    }
    validateEnum(item.status, [...path, "status"], ["complete", "needs-review"], issues);
    validatePolarPoints(item.points, [...path, "points"], issues);
  });
  return ids;
}

function validatePolarPoints(value: unknown, path: string[], issues: ValidationIssue[]) {
  readArray(value, path, issues).forEach((point, index) => {
    const pointPath = [...path, String(index)];
    if (!isRecord(point)) {
      addIssue(issues, pointPath, "Polar の点はオブジェクトである必要があります。");
      return;
    }
    for (const field of ["alpha", "cl", "cd", "cm"]) validateFiniteNumber(point[field], [...pointPath, field], issues);
  });
}

function validateAnalysisRuns(items: readonly unknown[], airfoilIds: ReadonlySet<string>, polarIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["airfoilAnalysisRuns", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "翼型解析 run はオブジェクトである必要があります。");
      return;
    }
    addUniqueId(item.id, path, ids, issues);
    validateNonEmptyString(item.name, [...path, "name"], issues);
    validateReferenceList(item.airfoilIds, [...path, "airfoilIds"], airfoilIds, "翼型", issues);
    validateReferenceList(item.polarIds, [...path, "polarIds"], polarIds, "Polar", issues);
    validateDate(item.createdAt, [...path, "createdAt"], issues);
    for (const field of ["reynolds", "mach", "alphaStart", "alphaEnd", "alphaStep"]) validateFiniteNumber(item[field], [...path, field], issues);
    validateEnum(item.status, [...path, "status"], ["complete", "needs-review"], issues);
  });
}

function validateAircraft(value: unknown, issues: ValidationIssue[]) {
  const path = ["aircraft"];
  if (!isRecord(value)) {
    addIssue(issues, path, "機体はオブジェクトである必要があります。");
    return null;
  }
  const id = validateNonEmptyString(value.id, [...path, "id"], issues);
  for (const field of ["span", "rootChord", "tipChord", "taperRatio", "twist", "dihedral", "sweep", "incidence", "wingArea", "aspectRatio", "mac", "staticMargin"]) {
    validateFiniteNumber(value[field], [...path, field], issues);
  }
  return { id, sections: readArray(value.sections, [...path, "sections"], issues) };
}

function validateWingSections(items: readonly unknown[], airfoilIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["aircraft", "sections", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "翼断面はオブジェクトである必要があります。");
      return;
    }
    addUniqueId(item.id, path, ids, issues);
    for (const field of ["yPosition", "chord", "xOffset", "twist", "dihedral"]) validateFiniteNumber(item[field], [...path, field], issues);
    validatePanelCount(item.chordwisePanels, [...path, "chordwisePanels"], issues);
    validatePanelCount(item.spanwisePanels, [...path, "spanwisePanels"], issues);
    validateReference(item.airfoilId, [...path, "airfoilId"], airfoilIds, "翼型", issues);
    validateEnum(item.chordwiseDistribution, [...path, "chordwiseDistribution"], ["uniform", "cosine", "sine", "inverse-sine"], issues);
    validateEnum(item.spanwiseDistribution, [...path, "spanwiseDistribution"], ["uniform", "cosine", "sine", "inverse-sine"], issues);
  });
}

function migrateVersion1WingSection(value: unknown, sweep: number): unknown {
  if (!isRecord(value)) return value;
  const yPosition = typeof value.spanPosition === "number" ? value.spanPosition : value.spanPosition;
  const { spanPosition: _spanPosition, ...section } = value;
  return {
    ...section,
    yPosition,
    xOffset: typeof yPosition === "number" ? Number((yPosition * Math.tan(sweep * Math.PI / 180)).toFixed(6)) : 0,
    chordwisePanels: 12,
    spanwisePanels: 8,
    chordwiseDistribution: "cosine",
    spanwiseDistribution: "uniform",
  };
}

function validateAnalysisCases(items: readonly unknown[], aircraftId: string | null | undefined, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["analysisCases", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "解析ケースはオブジェクトである必要があります。");
      return;
    }
    addUniqueId(item.id, path, ids, issues);
    validateNonEmptyString(item.name, [...path, "name"], issues);
    validateEnum(item.method, [...path, "method"], ["LLT", "VLM"], issues);
    for (const field of ["alphaStart", "alphaEnd", "alphaStep", "speed", "altitude", "reynolds"]) validateFiniteNumber(item[field], [...path, field], issues);
    validateReference(item.geometryId, [...path, "geometryId"], aircraftId ? new Set([aircraftId]) : new Set(), "機体形状", issues);
    validateEnum(item.status, [...path, "status"], ["completed", "not-run", "needs-review"], issues);
  });
  return ids;
}

function validateAnalysisResults(items: readonly unknown[], caseIds: ReadonlySet<string>, issues: ValidationIssue[]) {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    const path = ["analysisResults", String(index)];
    if (!isRecord(item)) {
      addIssue(issues, path, "解析結果はオブジェクトである必要があります。");
      return;
    }
    addUniqueId(item.id, path, ids, issues);
    const caseId = validateReference(item.caseId, [...path, "caseId"], caseIds, "解析ケース", issues);
    for (const field of ["clMax", "cdMin", "maxLD", "cm0"]) validateFiniteNumber(item[field], [...path, field], issues);
    validateEnum(item.status, [...path, "status"], ["completed", "not-run", "needs-review"], issues);
    readArray(item.rows, [...path, "rows"], issues).forEach((row, rowIndex) => {
      const rowPath = [...path, "rows", String(rowIndex)];
      if (!isRecord(row)) {
        addIssue(issues, rowPath, "解析結果の行はオブジェクトである必要があります。");
        return;
      }
      const rowCaseId = validateReference(row.caseId, [...rowPath, "caseId"], caseIds, "解析ケース", issues);
      if (caseId && rowCaseId && caseId !== rowCaseId) addIssue(issues, [...rowPath, "caseId"], "解析結果の行は親の解析ケースを参照する必要があります。");
      for (const field of ["alpha", "cl", "cd", "cm", "ld"]) validateFiniteNumber(row[field], [...rowPath, field], issues);
      validateEnum(row.status, [...rowPath, "status"], ["completed", "not-run", "needs-review"], issues);
      if (row.spanwise !== undefined) validateAerodynamicSpanwise(row.spanwise, [...rowPath, "spanwise"], row.alpha, issues);
    });
  });
}

function validateAerodynamicSpanwise(value: unknown, path: string[], rowAlpha: unknown, issues: ValidationIssue[]) {
  if (!isRecord(value)) { addIssue(issues, path, "翼幅方向分布はオブジェクトである必要があります。"); return; }
  if (!isRecord(value.axis)) addIssue(issues, [...path, "axis"], "分布軸が必要です。");
  else {
    if (value.axis.key !== "semi-span") addIssue(issues, [...path, "axis", "key"], "空力分布軸はsemi-spanである必要があります。");
    if (value.axis.unit !== "m") addIssue(issues, [...path, "axis", "unit"], "空力分布軸の単位はmである必要があります。");
  }
  if (!isRecord(value.reference)) addIssue(issues, [...path, "reference"], "空力分布の基準条件が必要です。");
  else {
    for (const field of ["alphaDegrees", "speed", "density", "elasticAxisChordFraction"]) validateFiniteNumber(value.reference[field], [...path, "reference", field], issues);
    if (typeof rowAlpha === "number" && value.reference.alphaDegrees !== rowAlpha) addIssue(issues, [...path, "reference", "alphaDegrees"], "解析行の迎角と一致する必要があります。");
    if (value.reference.side !== "right") addIssue(issues, [...path, "reference", "side"], "空力分布は右半翼である必要があります。");
    if (value.reference.origin !== "centerline") addIssue(issues, [...path, "reference", "origin"], "翼幅座標の原点はcenterlineである必要があります。");
  }
  let previous = Number.NEGATIVE_INFINITY;
  readArray(value.samples, [...path, "samples"], issues).forEach((sample, index) => {
    const samplePath = [...path, "samples", String(index)];
    if (!isRecord(sample)) { addIssue(issues, samplePath, "分布標本はオブジェクトである必要があります。"); return; }
    const position = validateFiniteNumber(sample.position, [...samplePath, "position"], issues);
    if (position !== null && position <= previous) addIssue(issues, [...samplePath, "position"], "翼幅座標は昇順かつ重複なしである必要があります。");
    if (position !== null) previous = position;
    if (!isRecord(sample.values)) { addIssue(issues, [...samplePath, "values"], "分布値が必要です。"); return; }
    for (const field of ["stationWidth", "chord", "circulation", "localLiftCoefficient", "liftPerLength", "inducedDragPerLength", "profileDragPerLength", "dragPerLength", "pitchingMomentPerLength", "torqueAboutElasticAxisPerLength"]) {
      validateFiniteNumber(sample.values[field], [...samplePath, "values", field], issues);
    }
  });
}

function validateReferenceList(value: unknown, path: string[], ids: ReadonlySet<string>, label: string, issues: ValidationIssue[]) {
  readArray(value, path, issues).forEach((id, index) => validateReference(id, [...path, String(index)], ids, label, issues));
}

function validateReference(value: unknown, path: string[], ids: ReadonlySet<string>, label: string, issues: ValidationIssue[]) {
  const id = validateNonEmptyString(value, path, issues);
  if (id && !ids.has(id)) addIssue(issues, path, `参照先の${label}「${id}」が存在しません。`);
  return id;
}

function validateDate(value: unknown, path: string[], issues: ValidationIssue[]) {
  const date = validateNonEmptyString(value, path, issues);
  if (date && Number.isNaN(Date.parse(date))) addIssue(issues, path, "日時は ISO 8601 形式である必要があります。");
}

function validateEnum(value: unknown, path: string[], values: readonly string[], issues: ValidationIssue[]) {
  if (typeof value !== "string" || !values.includes(value)) addIssue(issues, path, `値は ${values.join("、")} のいずれかである必要があります。`);
}

function validateFiniteNumber(value: unknown, path: string[], issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, path, "有限の数値である必要があります。");
    return null;
  }
  return value;
}

function validatePanelCount(value: unknown, path: string[], issues: ValidationIssue[]) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 200) {
    addIssue(issues, path, "パネル数は1から200までの整数である必要があります。");
  }
}

function validateNonEmptyString(value: unknown, path: string[], issues: ValidationIssue[]) {
  if (typeof value !== "string" || !value.trim()) {
    addIssue(issues, path, "空でない文字列である必要があります。");
    return null;
  }
  return value;
}

function addUniqueId(value: unknown, path: string[], ids: Set<string>, issues: ValidationIssue[]) {
  const id = validateNonEmptyString(value, [...path, "id"], issues);
  if (id && ids.has(id)) addIssue(issues, [...path, "id"], `ID「${id}」が重複しています。`);
  if (id) ids.add(id);
}

function readArray(value: unknown, path: string[], issues: ValidationIssue[]) {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "配列である必要があります。");
    return [];
  }
  return value;
}

function addIssue(issues: ValidationIssue[], path: string[], message: string) {
  issues.push({ path, message, severity: "error" });
}

function invalid(issues: readonly ValidationIssue[]): ValidationResult {
  return { valid: false, issues };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
