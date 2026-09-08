import { resolve } from "node:path";
import ts from "typescript";

interface GenerateProjectJsonSchemaOptions {
  projectRoot: string;
}

export type JsonSchema = boolean | { [key: string]: unknown };

export interface ProjectJsonSchema {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  $ref: string;
  $defs: Record<string, JsonSchema>;
  [key: string]: unknown;
}

const sourceFile = "src/app/designDocument.ts";
const rootTypeName = "DesignDocument";
const encodedNumberProperties = new Set(["bendingReserveFactor", "torsionReserveFactor", "minReserveFactor"]);
const projectTopLevelDescriptions: Readonly<Record<string, string>> = {
  schemaVersion: "ファイル形式のバージョン。現在は `4` 固定。",
  name: "設計プロジェクトの表示名。",
  conceptualDesign: "設計重量、巡航速度、最大翼幅などの概要設計条件。",
  airfoils: "翼型形状の一覧。",
  polars: "翼型ごとの XFoil Polar 一覧。",
  airfoilAnalysisRuns: "翼型解析の実行条件と結果参照。",
  aircraft: "主翼形状と翼幅方向セクション。",
  analysisCases: "LLT / VLM 空力解析ケース。",
  analysisResults: "保存済み空力解析結果。",
  carbonMaterials: "CFRP 材料特性の一覧。",
  structuralDesigns: "パイプ、積層、荷重ケースを含む構造設計案。",
  structuralResults: "保存済み構造解析結果。",
  aeroelasticResults: "保存済み空力・構造連成解析結果。",
};

export function generateProjectJsonSchema({ projectRoot }: GenerateProjectJsonSchemaOptions): ProjectJsonSchema {
  const absoluteSource = resolve(projectRoot, sourceFile);
  const configPath = resolve(projectRoot, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(formatDiagnostic(config.error));

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
  if (parsed.errors.length) throw new Error(parsed.errors.map(formatDiagnostic).join("\n"));

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(absoluteSource);
  if (!source) throw new Error(`${sourceFile} を TypeScript Program から取得できません。`);

  const declaration = source.statements.find((statement): statement is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(statement) && statement.name.text === rootTypeName,
  );
  if (!declaration) throw new Error(`${sourceFile} に ${rootTypeName} が見つかりません。`);

  const symbol = checker.getSymbolAtLocation(declaration.name);
  if (!symbol) throw new Error(`${rootTypeName} の型シンボルを取得できません。`);

  const builder = new SchemaBuilder(checker, projectRoot);
  builder.addDefinition(rootTypeName, checker.getDeclaredTypeOfSymbol(symbol));

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:hpa-design:schema:project:4",
    title: "HPADesign project document",
    description: "Machine-readable serialization contract for an HPADesign project file. Cross-object reference integrity is additionally checked by the application importer.",
    $comment: `Source type: ${sourceFile}#${rootTypeName}. Non-finite calculated values are encoded as {$hpaNumber: 'Infinity' | '-Infinity'}.`,
    $ref: `#/$defs/${rootTypeName}`,
    $defs: builder.definitions,
  };
}

class SchemaBuilder {
  readonly definitions: Record<string, JsonSchema> = {
    EncodedNonFiniteNumber: {
      type: "object",
      description: "JSON encoding used by HPADesign for a non-finite calculated number.",
      properties: { $hpaNumber: { enum: ["Infinity", "-Infinity"] } },
      required: ["$hpaNumber"],
      additionalProperties: false,
    },
  };

  private readonly definitionTypes = new Map<string, ts.Type>();

  constructor(private readonly checker: ts.TypeChecker, private readonly projectRoot: string) {}

  addDefinition(name: string, type: ts.Type) {
    const existing = this.definitionTypes.get(name);
    if (existing && existing !== type) throw new Error(`JSON Schema の定義名 ${name} が重複しています。`);
    if (existing) return;

    this.definitionTypes.set(name, type);
    this.definitions[name] = {};
    this.definitions[name] = this.schemaForType(type, false);
  }

  private schemaForType(type: ts.Type, allowReference = true): JsonSchema {
    const concreteType = removeUndefined(type);
    const definitionName = allowReference ? this.definitionName(concreteType) : null;
    if (definitionName) {
      this.addDefinition(definitionName, concreteType);
      return { $ref: `#/$defs/${escapeJsonPointer(definitionName)}` };
    }

    if (concreteType.flags & ts.TypeFlags.Any || concreteType.flags & ts.TypeFlags.Unknown) return {};
    if (concreteType.flags & ts.TypeFlags.Never) return false;
    if (concreteType.flags & ts.TypeFlags.StringLiteral) return { type: "string", const: (concreteType as ts.StringLiteralType).value };
    if (concreteType.flags & ts.TypeFlags.NumberLiteral) return { type: "number", const: (concreteType as ts.NumberLiteralType).value };
    if (concreteType.flags & ts.TypeFlags.BooleanLiteral) return { type: "boolean", const: this.checker.typeToString(concreteType) === "true" };
    if (concreteType.flags & ts.TypeFlags.StringLike) return { type: "string" };
    if (concreteType.flags & ts.TypeFlags.NumberLike) return { type: "number" };
    if (concreteType.flags & ts.TypeFlags.BooleanLike) return { type: "boolean" };
    if (concreteType.flags & ts.TypeFlags.Null) return { type: "null" };

    if (concreteType.isUnion()) return this.schemaForUnion(concreteType.types);
    if (this.checker.isTupleType(concreteType)) return this.schemaForTuple(concreteType);

    const arrayElement = arrayElementType(this.checker, concreteType);
    if (arrayElement) return { type: "array", items: this.schemaForType(arrayElement) };
    if (isObjectType(concreteType)) return this.schemaForObject(concreteType);

    throw new Error(`JSON Schema に変換できない型です: ${this.checker.typeToString(concreteType)}`);
  }

  private schemaForUnion(types: readonly ts.Type[]): JsonSchema {
    const defined = types.filter((type) => !(type.flags & ts.TypeFlags.Undefined));
    const literals = defined.map(literalValue);
    if (literals.every((value) => value !== noLiteral)) {
      const values = literals.filter((value) => value !== noLiteral);
      const primitiveTypes = Array.from(new Set(values.map(jsonPrimitiveType)));
      return primitiveTypes.length === 1 ? { type: primitiveTypes[0], enum: values } : { enum: values };
    }
    return { anyOf: defined.map((type) => this.schemaForType(type)) };
  }

  private schemaForTuple(type: ts.Type): JsonSchema {
    const elements = this.checker.getTypeArguments(type as ts.TypeReference);
    return {
      type: "array",
      prefixItems: elements.map((element) => this.schemaForType(element)),
      items: false,
      minItems: elements.length,
      maxItems: elements.length,
    };
  }

  private schemaForObject(type: ts.Type): JsonSchema {
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const property of this.checker.getPropertiesOfType(type)) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      if (!declaration) continue;

      const propertyType = this.checker.getTypeOfSymbolAtLocation(property, declaration);
      let propertySchema = encodedNumberProperties.has(property.name) && isNumberType(removeUndefined(propertyType))
        ? { anyOf: [{ type: "number" }, { type: "null" }, { $ref: "#/$defs/EncodedNonFiniteNumber" }] }
        : this.schemaForType(propertyType);
      const description = documentationFor(this.checker, property) ?? projectTopLevelDescriptions[property.name];
      if (description && typeof propertySchema === "object") propertySchema = { ...propertySchema, description };
      if (property.name === "createdAt" && typeof propertySchema === "object") propertySchema = { ...propertySchema, format: "date-time" };
      if ((property.name === "id" || property.name === "name") && typeof propertySchema === "object" && propertySchema.type === "string") {
        propertySchema = { ...propertySchema, minLength: 1 };
      }

      properties[property.name] = propertySchema;
      if ((property.flags & ts.SymbolFlags.Optional) === 0) required.push(property.name);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  private definitionName(type: ts.Type) {
    const symbol = type.aliasSymbol ?? type.getSymbol();
    const name = symbol?.getName();
    if (!symbol || !name || name.startsWith("__") || name === "Array" || name === "ReadonlyArray") return null;

    const declaration = symbol.declarations?.[0];
    if (!declaration) return null;
    const fileName = resolve(declaration.getSourceFile().fileName);
    if (!fileName.startsWith(resolve(this.projectRoot, "src"))) return null;
    return name;
  }
}

const noLiteral = Symbol("not a literal");

function literalValue(type: ts.Type): string | number | boolean | null | typeof noLiteral {
  if (type.flags & ts.TypeFlags.StringLiteral) return (type as ts.StringLiteralType).value;
  if (type.flags & ts.TypeFlags.NumberLiteral) return (type as ts.NumberLiteralType).value;
  if (type.flags & ts.TypeFlags.BooleanLiteral) return type.intrinsicName === "true";
  if (type.flags & ts.TypeFlags.Null) return null;
  return noLiteral;
}

function jsonPrimitiveType(value: string | number | boolean | null) {
  if (value === null) return "null";
  return typeof value;
}

function arrayElementType(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  if (checker.isArrayType(type)) return checker.getElementTypeOfArrayType(type) ?? null;
  const symbolName = type.aliasSymbol?.getName() ?? type.getSymbol()?.getName();
  if ((symbolName === "Array" || symbolName === "ReadonlyArray") && (type.flags & ts.TypeFlags.Object)) {
    return checker.getTypeArguments(type as ts.TypeReference)[0] ?? null;
  }
  return null;
}

function removeUndefined(type: ts.Type): ts.Type {
  if (!type.isUnion()) return type;
  const defined = type.types.filter((item) => !(item.flags & ts.TypeFlags.Undefined));
  return defined.length === 1 ? defined[0] : type;
}

function isObjectType(type: ts.Type) {
  return Boolean(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection));
}

function isNumberType(type: ts.Type) {
  return Boolean(type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral | ts.TypeFlags.NumberLike));
}

function documentationFor(checker: ts.TypeChecker, property: ts.Symbol) {
  const documentation = ts.displayPartsToString(property.getDocumentationComment(checker)).trim();
  return documentation || null;
}

function escapeJsonPointer(value: string) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function formatDiagnostic(diagnostic: ts.Diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}
