import type { Exporter, Importer, ValidationIssue, ValidationResult } from "../shared/model/transfer";
import type { DesignDocument } from "./designDocument";

type JsonRecord = Record<string, unknown>;

export const designDocumentImporter: Importer<string, DesignDocument> = {
  parse: async (input) => parseDesignDocument(input),
  validate: (document) => validateDesignDocument(document),
};

export const designDocumentExporter: Exporter<DesignDocument, string> = {
  export: async (document) => JSON.stringify(document, null, 2),
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
  const arrays = validateRequiredArrays(document, issues);
  const aircraft = validateAircraft(document.aircraft, issues);

  const airfoilIds = validateAirfoils(arrays.airfoils, issues);
  validateWingSections(aircraft?.sections ?? [], airfoilIds, issues);
  const polarIds = validatePolars(arrays.polars, airfoilIds, issues);
  validateAnalysisRuns(arrays.airfoilAnalysisRuns, airfoilIds, polarIds, issues);
  const caseIds = validateAnalysisCases(arrays.analysisCases, aircraft?.id, issues);
  validateAnalysisResults(arrays.analysisResults, caseIds, issues);

  return issues.length ? invalid(issues) : { valid: true };
}

function parseDesignDocument(input: string): DesignDocument {
  try {
    return migrateDesignDocument(JSON.parse(input)) as DesignDocument;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`設計ファイルを JSON として読み込めません: ${error.message}`);
    }
    throw error;
  }
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
      return {
        ...document,
        schemaVersion: 2,
        aircraft: aircraft ? { ...aircraft, sections } : document.aircraft,
      };
    }
    case 2:
      return document;
    default:
      return document;
  }
}

function validateSchemaVersion(document: JsonRecord, issues: ValidationIssue[]) {
  if (document.schemaVersion !== 2) {
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
  };
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
    });
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
