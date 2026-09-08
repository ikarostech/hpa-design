import { ChevronDown, ExternalLink, FileJson, Search } from "lucide-react";
import { useMemo, useState } from "react";
import projectSchemaDocument from "../../schemas/project.schema.json";
import { Card, CardBody } from "../shared/ui/Card";
import { PageTemplate } from "../shared/ui/layout/PageTemplate";

interface SchemaNode {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  prefixItems?: SchemaNode[];
  anyOf?: SchemaNode[];
  enum?: unknown[];
  const?: unknown;
  additionalProperties?: boolean | SchemaNode;
}

interface ProjectSchema extends SchemaNode {
  $schema: string;
  $id: string;
  $defs: Record<string, SchemaNode>;
}

const projectSchema = projectSchemaDocument as unknown as ProjectSchema;
const schemaUrl = `${import.meta.env.BASE_URL}schemas/project.schema.json`;

export function ProjectSchemaPage() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const definitions = Object.entries(projectSchema.$defs);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredDefinitions = useMemo(() => definitions.filter(([name, schema]) => {
    if (!normalizedQuery) return true;
    const searchable = [name, schema.title, schema.description, ...Object.keys(schema.properties ?? {})]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(normalizedQuery);
  }), [normalizedQuery]);

  const toggleDefinition = (name: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const showReference = (name: string) => {
    setQuery("");
    setExpanded((current) => new Set(current).add(name));
    requestAnimationFrame(() => document.getElementById(`schema-${name}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  return (
    <PageTemplate
      title="プロジェクトファイル仕様"
      description="アプリが読み書きするJSONファイルを、生成済みJSON Schemaから参照できます。"
      actions={(
        <a className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" href={schemaUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> JSON Schemaを開く
        </a>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="形式" value="JSON Schema Draft 2020-12" />
        <Summary label="スキーマID" value={projectSchema.$id} mono />
        <Summary label="定義数" value={definitions.length.toString()} />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-950"><FileJson size={18} /> 型定義</h2>
              <p className="mt-1 text-sm text-slate-500">型を展開すると、プロパティ、必須項目、参照先を確認できます。</p>
            </div>
            <label className="relative block w-full sm:w-80">
              <span className="sr-only">型を検索</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
              <input
                aria-label="型を検索"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="型名・プロパティ名で検索"
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200">
            {filteredDefinitions.map(([name, schema]) => {
              const isExpanded = expanded.has(name);
              return (
                <section id={`schema-${name}`} key={name} className="scroll-mt-20 bg-white">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleDefinition(name)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-mono text-sm font-semibold text-blue-700">{name}</span>
                      {schema.description ? <span className="mt-1 block text-sm text-slate-500">{schema.description}</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {formatType(schema)}
                      <ChevronDown size={17} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {isExpanded ? <DefinitionDetails schema={schema} onShowReference={showReference} /> : null}
                </section>
              );
            })}
            {filteredDefinitions.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">一致する型はありません。</p> : null}
          </div>
        </CardBody>
      </Card>
    </PageTemplate>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Card><CardBody>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 break-all text-sm font-semibold text-slate-950 ${mono ? "font-mono" : ""}`}>{value}</p>
    </CardBody></Card>
  );
}

function DefinitionDetails({ schema, onShowReference }: { schema: SchemaNode; onShowReference: (name: string) => void }) {
  const required = new Set(schema.required ?? []);
  const properties = Object.entries(schema.properties ?? {});

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
      {properties.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr><th className="px-3 py-2 font-medium">プロパティ</th><th className="px-3 py-2 font-medium">型</th><th className="px-3 py-2 font-medium">説明</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map(([propertyName, property]) => (
                <tr key={propertyName} className="align-top">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900">
                    {propertyName}
                    {required.has(propertyName) ? <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-red-700">必須</span> : null}
                  </td>
                  <td className="px-3 py-2.5"><TypeDisplay schema={property} onShowReference={onShowReference} /></td>
                  <td className="px-3 py-2.5 leading-5 text-slate-600">{property.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-500">プロパティを持たない値型です。</p>}
      {(schema.enum || schema.const !== undefined) ? (
        <p className="mt-3 text-xs text-slate-600"><span className="font-medium">許可値:</span> <code>{JSON.stringify(schema.enum ?? [schema.const])}</code></p>
      ) : null}
    </div>
  );
}

function TypeDisplay({ schema, onShowReference }: { schema: SchemaNode; onShowReference: (name: string) => void }) {
  const reference = referenceName(schema.$ref ?? schema.items?.$ref);
  if (reference) {
    return (
      <span className="inline-flex items-center gap-1">
        {schema.type === "array" ? <span className="font-mono text-xs text-slate-500">array&lt;</span> : null}
        <button type="button" onClick={() => onShowReference(reference)} aria-label={`${reference}型を表示`} className="font-mono text-xs font-semibold text-blue-700 hover:underline">{reference}</button>
        {schema.type === "array" ? <span className="font-mono text-xs text-slate-500">&gt;</span> : null}
      </span>
    );
  }
  return <code className="text-xs text-slate-700">{formatType(schema)}</code>;
}

function referenceName(reference?: string) {
  return reference?.startsWith("#/$defs/") ? reference.slice("#/$defs/".length) : undefined;
}

function formatType(schema: SchemaNode): string {
  if (schema.$ref) return referenceName(schema.$ref) ?? "$ref";
  if (schema.type === "array") return schema.items ? `array<${formatType(schema.items)}>` : "array";
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.type) return schema.type;
  if (schema.enum) return "enum";
  if (schema.anyOf) return schema.anyOf.map(formatType).join(" | ");
  return "value";
}
