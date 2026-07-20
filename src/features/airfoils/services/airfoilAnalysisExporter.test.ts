import { describe, expect, it } from "vitest";
import { airfoilAnalysisExporter } from "./airfoilAnalysisExporter";

const run = { id: "run-1", name: "Cruise", airfoilIds: ["af-1"], polarIds: ["polar-1"], createdAt: "2026-07-17T00:00:00.000Z", reynolds: 300000, mach: 0.04, alphaStart: -4, alphaEnd: 8, alphaStep: 2, ncrit: 9, iterations: 100, status: "complete" as const };
const polar = { id: "polar-1", airfoilId: "af-1", caseName: "Cruise", reynolds: 300000, mach: 0.04, alphaStart: -4, alphaEnd: 8, alphaStep: 2, ncrit: 9, convergedPoints: 1, requestedPoints: 1, status: "complete" as const, points: [{ alpha: 2, cl: 0.98765, cd: 0.023456, cm: -0.03456 }] };

describe("airfoilAnalysisExporter", () => {
  it("exports only the requested run polars as fixed UTF-8 BOM CSV", async () => {
    const output = await airfoilAnalysisExporter.export({ designName: "Long Range UAV", run, polars: [polar] });
    expect(output).toMatchObject({ fileName: "long-range-uav-cruise-polars.csv", mimeType: "text/csv;charset=utf-8" });
    expect(output.content).toBe("\uFEFFrun_id,polar_id,airfoil_id,reynolds,mach,alpha_deg,cl,cd,cm\r\nrun-1,polar-1,af-1,300000,0.040,2.0,0.9877,0.023456,-0.0346\r\n");
  });
});
