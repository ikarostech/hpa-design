import fs from "node:fs";
import { createJiti } from "jiti";
import { parsePolarRows, WebXFOIL } from "webxfoil-wasm";

const jiti = createJiti(import.meta.url);
const { createNaca4Airfoil } = await jiti.import("../src/features/airfoils/model/airfoilGeometry.ts");
const { deriveWingGeometry } = await jiti.import("../src/features/aircraft/model/wingGeometry.ts");
const { executeAnalysisCase } = await jiti.import("../src/features/analysis/services/analysisExecutionService.ts");
const path = new URL("../examples/Anonymized-HPA-Reference.json", import.meta.url);
const project = JSON.parse(fs.readFileSync(path, "utf8"));
const previousAirfoilId = "af-reference-hpa-naca0012";
const airfoil = createNaca4Airfoil("0042", "af-reference-hpa-naca0042");
project.aircraft.sparChordFraction = 0.35;
project.airfoils = [...project.airfoils.filter((item) => item.id !== previousAirfoilId && item.id !== airfoil.id), airfoil];
for (const surface of project.aircraft.tailSurfaces ?? []) {
  surface.sparChordFraction = 0.25;
  for (const section of surface.sections) {
    section.leftAirfoilId = airfoil.id;
    section.rightAirfoilId = airfoil.id;
  }
}
const wingQuarterMacX = deriveWingGeometry(project.aircraft.sections).quarterMacX;
const elevator = project.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-elevator");
if (elevator) {
  const rootChord = elevator.sections[0].chord;
  for (const section of elevator.sections) {
    section.xOffset = round((rootChord - section.chord) / 4, 6);
  }
  elevator.rootPosition.x = round(wingQuarterMacX + 4.3 - rootChord / 4, 6);
}
const rudder = project.aircraft.tailSurfaces?.find((surface) => surface.id === "reference-hpa-rudder");
if (rudder) {
  const correctedSection = rudder.sections.find((section) => section.spanPosition === 2.4);
  if (!correctedSection) throw new Error("The rudder's 1800 mm station is missing.");
  correctedSection.chord = 0.66;
  const rootChord = rudder.sections[0].chord;
  for (const section of rudder.sections) {
    section.xOffset = round((rootChord - section.chord) / 4, 6);
  }
  rudder.rootPosition.x = round(wingQuarterMacX + 5.15 - rootChord / 4, 6);
}

const reynoldsNumbers = [200000, 300000, 450000, 600000];
const alphaValues = Array.from({ length: 13 }, (_, index) => index - 4);
const polarPrefix = `${airfoil.id}-re`;
const runPrefix = "reference-hpa-naca0042-re";
const existingRun = project.airfoilAnalysisRuns.find((run) => run.id.startsWith(runPrefix));
const createdAt = existingRun?.createdAt ?? new Date().toISOString();
const polars = [];
const runs = [];

for (const reynolds of reynoldsNumbers) {
  const xfoil = await WebXFOIL.load();
  try {
    const polarPath = "/work/polar.dat";
    const input = WebXFOIL.input()
      .naca("0042")
      .add("PANE")
      .oper()
      .add("MACH 0.03")
      .add(`VISC ${reynolds}`)
      .add("ITER 250")
      .add("VPAR")
      .add("N 9")
      .blank()
      .add("PACC")
      .add(polarPath)
      .blank()
      .add("ASEQ 0 8 1")
      .add("INIT")
      .add("ASEQ -1 -4 -1")
      .add("PACC")
      .add("QUIT");
    const result = xfoil.run(input.toString(), { workDir: "/work", files: input.files });
    if (result.raw.exitCode !== 0 || result.output.hasFortranError) {
      throw new Error(`XFOIL failed at Re=${reynolds}.`);
    }
    const points = parsePolarRows(xfoil.readFile(polarPath, "utf8"))
      .map((row) => ({
        alpha: round(row.alpha, 3),
        cl: round(row.cl, 4),
        cd: round(row.cd, 5),
        cm: round(row.cm, 4),
      }))
      .sort((left, right) => left.alpha - right.alpha);
    if (points.length !== alphaValues.length || points.some((point, index) =>
      point.alpha !== alphaValues[index] || ![point.cl, point.cd, point.cm].every(Number.isFinite))) {
      throw new Error(`XFOIL did not converge for every requested angle at Re=${reynolds}.`);
    }

    const id = `${polarPrefix}${Math.round(reynolds / 1000)}k-xfoil`;
    polars.push({
      id, airfoilId: airfoil.id, caseName: `NACA0042_Re${Math.round(reynolds / 1000)}k_XFOIL`,
      reynolds, mach: 0.03, alphaStart: -4, alphaEnd: 8, alphaStep: 1, ncrit: 9,
      convergedPoints: points.length, requestedPoints: alphaValues.length,
      status: "complete", points,
    });
    runs.push({
      id: `${runPrefix}${Math.round(reynolds / 1000)}k`,
      name: `NACA0042 尾翼 Re=${Math.round(reynolds / 1000)}k`,
      airfoilIds: [airfoil.id], polarIds: [id], createdAt,
      reynolds, mach: 0.03, alphaStart: -4, alphaEnd: 8, alphaStep: 1,
      ncrit: 9, iterations: 250, status: "complete",
    });
    console.log(`Re=${reynolds}: ${points.length} converged points`);
  } finally {
    xfoil.destroy();
  }
}

project.polars = [
  ...project.polars.filter((polar) => polar.airfoilId !== previousAirfoilId && polar.airfoilId !== airfoil.id),
  ...polars,
];
project.airfoilAnalysisRuns = [
  ...project.airfoilAnalysisRuns.filter((run) => !run.id.startsWith(runPrefix) && !run.id.startsWith("reference-hpa-naca0012-re")),
  ...runs,
];
const analysisCase = {
  id: "reference-hpa-whole-aircraft-tail-vlm",
  name: "主翼・尾翼 全機 VLM 7.4 m/s",
  method: "VLM",
  scope: "aircraft",
  beta: 0,
  alphaStart: 2,
  alphaEnd: 2,
  alphaStep: 1,
  speed: 7.4,
  altitude: 0,
  reynolds: 450000,
  geometryId: project.aircraft.id,
  status: "completed",
};
const result = await executeAnalysisCase({
  analysisCase, aircraft: project.aircraft, polars: project.polars,
  createId: () => "reference-hpa-whole-aircraft-tail-vlm-result",
  onProgress: () => undefined,
});
project.analysisCases = [...project.analysisCases.filter((item) => item.id !== analysisCase.id), analysisCase];
project.analysisResults = [...project.analysisResults.filter((item) => item.caseId !== analysisCase.id), result];
fs.writeFileSync(path, `${JSON.stringify(project, null, 2)}\n`);

function round(value, digits) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : Number.NaN;
}
