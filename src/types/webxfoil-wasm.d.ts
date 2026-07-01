declare module "webxfoil-wasm" {
  export interface XfoilRawOutput {
    stdout: string;
    stderr: string;
    exitCode: number;
  }

  export interface XfoilParsedOutput {
    text: string;
    scalars: Record<string, { raw: string; value: number }>;
    hasNaN: boolean;
    hasFortranError: boolean;
    hasConvergenceFail: boolean;
  }

  export interface XfoilRunResult {
    raw: XfoilRawOutput;
    output: XfoilParsedOutput;
  }

  export interface XfoilPolarRow {
    alpha: number;
    cl: number;
    cd: number;
    cdp?: number;
    cm: number;
  }

  export class XfoilInput {
    naca(code: string): this;
    add(line: string | string[]): this;
    blank(count?: number): this;
    oper(): this;
    setAlpha(value: number): this;
    loadAirfoilText(text: string, options?: { path?: string; name?: string }): { name: string; format: string; path: string };
    get files(): Array<{ path: string; data: string | Uint8Array | ArrayBuffer }>;
    toString(): string;
  }

  export class WebXFOIL {
    static load(options?: Record<string, unknown>): Promise<WebXFOIL>;
    static input(lines?: string[]): XfoilInput;
    run(sessionText: string, options?: { files?: Array<{ path: string; data: string | Uint8Array | ArrayBuffer }>; workDir?: string; scalarKeys?: string[] }): XfoilRunResult;
    readFile(path: string, encoding?: string): string;
    destroy(): void;
  }

  export function parsePolarRows(text: string): XfoilPolarRow[];
}
