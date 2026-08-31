import { parsePolarRows, WebXFOIL } from "webxfoil-wasm";
import xfoilModuleUrl from "webxfoil-wasm/dist/xfoil.js?url";
import xfoilWasmUrl from "webxfoil-wasm/dist/xfoil.wasm?url";
import type { XfoilAnalysisSettings } from "../model/analysis";
import { validateXfoilAnalysisSettings } from "../model/analysisValidation";
import { buildXfoilAirfoilInput } from "../model/xfoilAirfoilInput";
import { createXfoilAlphaSequences } from "../model/xfoilSweep";
import type { Airfoil, AirfoilPolar } from "../model/types";

interface RunRequest {
  type: "run";
  airfoil: Airfoil;
  settings: XfoilAnalysisSettings;
  polarId: string;
}

interface PolarPoint {
  alpha: number;
  cl: number;
  cd: number;
  cm: number;
}

self.addEventListener("message", async (event: MessageEvent<RunRequest>) => {
  if (event.data.type !== "run") {
    return;
  }

  try {
    const polar = await runXfoil(event.data);
    self.postMessage({ type: "success", polar });
  } catch (error) {
    self.postMessage({
      type: "failure",
      message: error instanceof Error ? error.message : "XFOIL解析に失敗しました。",
    });
  } finally {
    self.close();
  }
});

async function runXfoil({ airfoil, settings, polarId }: RunRequest): Promise<AirfoilPolar> {
  const validation = validateXfoilAnalysisSettings(settings);
  if (!validation.valid) {
    throw new Error(Object.values(validation.errors).join(" "));
  }
  const alphaSequences = createXfoilAlphaSequences(settings.alphaStart, settings.alphaEnd, settings.alphaStep);
  const requestedPoints = alphaSequences.flat().length;
  const xfoil = await WebXFOIL.load({ moduleUrl: xfoilModuleUrl, wasmUrl: xfoilWasmUrl });
  const polarPath = "/work/polar.dat";

  try {
    const input = WebXFOIL.input();
    const airfoilInput = buildXfoilAirfoilInput(airfoil);
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
      .blank();
    alphaSequences.forEach((sequence, index) => {
      if (index > 0) input.add("INIT");
      if (sequence.length === 1) {
        input.add(`ALFA ${sequence[0]}`);
      } else {
        input.add(`ASEQ ${sequence[0]} ${sequence[sequence.length - 1]} ${sequence[1] - sequence[0]}`);
      }
    });
    input.add("PACC").add("QUIT");

    const result = xfoil.run(input.toString(), { workDir: "/work", files: input.files });
    if (result.output.hasFortranError || result.raw.exitCode !== 0) {
      throw new Error("XFOIL実行時にエラーが発生しました。入力条件を確認してください。");
    }

    const points = readPolarPoints(xfoil.readFile(polarPath, "utf8"));
    if (!points.length) {
      throw new Error("XFOILのPolar結果を取得できませんでした。");
    }

    const convergedCount = points.filter((point) => Number.isFinite(point.cl) && Number.isFinite(point.cd)).length;
    return {
      id: polarId,
      airfoilId: airfoil.id,
      caseName: `${airfoil.name}_Re${Math.round(settings.reynolds / 1000)}k_XFOIL`,
      reynolds: settings.reynolds,
      mach: settings.mach,
      alphaStart: settings.alphaStart,
      alphaEnd: settings.alphaEnd,
      alphaStep: settings.alphaStep,
      ncrit: settings.ncrit,
      convergedPoints: convergedCount,
      requestedPoints,
      status: convergedCount === requestedPoints ? "complete" : "needs-review",
      points,
    };
  } finally {
    xfoil.destroy();
  }
}

function readPolarPoints(polarText: string): PolarPoint[] {
  return parsePolarRows(polarText).map((row) => ({
    alpha: roundFinite(row.alpha, 3),
    cl: roundFinite(row.cl, 4),
    cd: roundFinite(row.cd, 5),
    cm: roundFinite(row.cm, 4),
  })).sort((left, right) => left.alpha - right.alpha);
}

function roundFinite(value: number | undefined, digits: number) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : Number.NaN;
}
