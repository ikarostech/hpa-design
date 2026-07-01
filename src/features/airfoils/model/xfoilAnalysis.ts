import { parsePolarRows, WebXFOIL } from "webxfoil-wasm";
import xfoilModuleUrl from "webxfoil-wasm/dist/xfoil.js?url";
import xfoilWasmUrl from "webxfoil-wasm/dist/xfoil.wasm?url";
import type { Airfoil, AirfoilPolar } from "./types";

export interface XfoilAnalysisSettings {
  reynolds: number;
  mach: number;
  alphaStart: number;
  alphaEnd: number;
  alphaStep: number;
  ncrit: number;
  iterations: number;
}

interface XfoilPolarPoint {
  alpha: number;
  cl: number;
  cd: number;
  cm: number;
}

export async function runXfoilAnalysis(airfoil: Airfoil, settings: XfoilAnalysisSettings): Promise<AirfoilPolar> {
  const alphas = makeAlphaSweep(settings.alphaStart, settings.alphaEnd, settings.alphaStep);
  const xfoil = await loadXfoil();
  const airfoilInput = buildAirfoilInput(airfoil);
  const polarPath = "/work/polar.dat";

  try {
    const input = WebXFOIL.input();
    if (airfoilInput.kind === "naca") {
      input.naca(airfoilInput.code);
    } else {
      input.loadAirfoilText(airfoilInput.text, { path: "airfoil_input.dat", name: airfoil.name });
    }

    input
      .add("PANE")
      .oper()
      .add(`MACH ${settings.mach}`)
      .add(`VISC ${settings.reynolds}`)
      .add(`ITER ${settings.iterations}`)
      .add("VPAR")
      .add(`N ${settings.ncrit}`)
      .blank()
      .add("PACC")
      .add(polarPath)
      .blank()
      .add(`ASEQ ${settings.alphaStart} ${settings.alphaEnd} ${Math.abs(settings.alphaStep) || 1}`)
      .add("PACC")
      .add("QUIT");

    const result = xfoil.run(input.toString(), {
      workDir: "/work",
      files: input.files,
    });
    if (result.output.hasFortranError || result.raw.exitCode !== 0) {
      throw new Error("XFOIL実行時にエラーが発生しました。入力条件を確認してください。");
    }

    const points = readPolarPoints(xfoil.readFile(polarPath, "utf8"));
    if (!points.length) {
      throw new Error("XFOILのPolar結果を取得できませんでした。");
    }

    const convergedCount = points.filter((point) => Number.isFinite(point.cl) && Number.isFinite(point.cd)).length;
    return {
      id: `xfoil-${airfoil.id}-${Date.now()}`,
      airfoilId: airfoil.id,
      caseName: `${airfoil.name}_Re${Math.round(settings.reynolds / 1000)}k_XFOIL`,
      reynolds: settings.reynolds,
      mach: settings.mach,
      alphaRange: `${settings.alphaStart}° to ${settings.alphaEnd}°`,
      ncrit: settings.ncrit,
      converged: `${convergedCount}/${alphas.length}`,
      status: convergedCount === alphas.length ? "完了" : "要確認",
      points,
    };
  } finally {
    xfoil.destroy();
  }
}

function loadXfoil() {
  return WebXFOIL.load({
    moduleUrl: xfoilModuleUrl,
    wasmUrl: xfoilWasmUrl,
  });
}

function makeAlphaSweep(start: number, end: number, step: number) {
  const safeStep = Math.abs(step) > 0 ? Math.abs(step) : 1;
  const direction = start <= end ? 1 : -1;
  const values: number[] = [];

  for (let alpha = start; direction > 0 ? alpha <= end + 1e-9 : alpha >= end - 1e-9; alpha += safeStep * direction) {
    values.push(Number(alpha.toFixed(6)));
  }

  return values;
}

function readPolarPoints(polarText: string): XfoilPolarPoint[] {
  return parsePolarRows(polarText).map((row) => ({
    alpha: roundFinite(row.alpha, 3),
    cl: roundFinite(row.cl, 4),
    cd: roundFinite(row.cd, 5),
    cm: roundFinite(row.cm, 4),
  }));
}

function roundFinite(value: number | undefined, digits: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Number.NaN;
  }
  return Number(value.toFixed(digits));
}

function buildAirfoilInput(airfoil: Airfoil): { kind: "naca"; code: string } | { kind: "file"; text: string } {
  const nacaMatch = /^NACA\s*([0-9]{4})$/i.exec(airfoil.name.trim());
  if (nacaMatch) {
    return { kind: "naca", code: nacaMatch[1] };
  }

  const upper = [...airfoil.coordinates].reverse().map((point) => `${point.x.toFixed(6)} ${point.upper.toFixed(6)}`);
  const lower = airfoil.coordinates.slice(1).map((point) => `${point.x.toFixed(6)} ${point.lower.toFixed(6)}`);
  return {
    kind: "file",
    text: [airfoil.name, ...upper, ...lower].join("\n"),
  };
}
