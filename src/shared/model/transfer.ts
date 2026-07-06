export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  path?: readonly string[];
  message: string;
  severity: ValidationSeverity;
}

export type ValidationResult =
  | { valid: true; issues?: readonly ValidationIssue[] }
  | { valid: false; issues: readonly ValidationIssue[] };

export interface Importer<TInput, TResult> {
  parse: (input: TInput) => Promise<TResult>;
  validate: (result: TResult) => ValidationResult | Promise<ValidationResult>;
}

export interface Exporter<TSource, TOutput> {
  export: (source: TSource) => Promise<TOutput>;
}
