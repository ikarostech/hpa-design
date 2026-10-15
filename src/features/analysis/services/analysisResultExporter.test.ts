import { describe, expect, it } from "vitest";
import { analysisResultExporter, createDesignSummary } from "./analysisResultExporter";

const result = {
  id: "result-cruise",
  caseId: "case-cruise",
  clMax: 1.23456,
  cdMin: 0.023456,
  maxLD: 42.345,
  cm0: -0.03456,
  status: "completed" as const,
  rows: [
    { caseId: "case-cruise", alpha: 2, cl: 0.98765, cd: 0.023456, cm: -0.03456, ld: 42.345, status: "completed" as const },
  ],
};

describe("analysisResultExporter", () => {
  it("exports the selected stability shape and manual deformation alongside the coefficients", async () => {
    const manual = { ...result, caseSnapshot: { id: result.caseId, name: "Manual", scope: "aircraft" as const, method: "VLM" as const,
      geometryId: "wing", speed: 10, altitude: 0, reynolds: 100000, alphaStart: 2, alphaEnd: 2, alphaStep: 1, status: "completed" as const,
      stabilityShape: { kind: "manual" as const, elasticAxisChordFraction: 0.35,
        points: [{ yPosition: 0, deflection: 0, twist: 0 }, { yPosition: 2, deflection: 0.3, twist: -2 }] } } };
    const csv = await analysisResultExporter.export({ results: [manual], selectedResultIds: [manual.id], designName: "Shapes" });
    expect(csv.content).toContain("[stability_shapes]");
    expect(csv.content).toContain("result_id,shape_kind,fsi_result_id,fsi_created_at,fsi_speed_m_per_s,fsi_alpha_deg");
    expect(csv.content).toContain("result-cruise,manual");
    expect(csv.content).toContain("[manual_deformation]");
    expect(csv.content).toContain("result-cruise,2,0.3,-2,0.35");
  });
  it("exports whole-aircraft force and per-surface contributions with an inviscid label", async () => {
    const whole = { ...result, caseSnapshot: { id: "case-cruise", name: "Coupled", method: "VLM" as const, scope: "aircraft" as const,
      beta: 3, alphaStart: 2, alphaEnd: 2, alphaStep: 1, speed: 10, altitude: 0, reynolds: 100000, geometryId: "aircraft", status: "completed" as const },
      rows: [{ ...result.rows[0], cy: 0.01, cr: 0.02, cn: 0.03, cdi: 0.023456, crBeta: -0.15, cyBeta: 0.3, cnBeta: 0.09, cgX: 0.4, cgZ: -0.2,
        surfaceLoads: [{ surfaceId: "tail", cl: 0.1, cy: 0.01, cm: 0.02, cr: 0, cn: 0.03 }] }] };
    const output = await analysisResultExporter.export({ results: [whole], selectedResultIds: [whole.id], designName: "Coupled" });
    expect(output.content).toContain("[whole_aircraft_inviscid]");
    expect(output.content).toContain("result-cruise,case-cruise,2,0.01,0.02,0.03,0.023456");
    expect(output.content).toContain("[surface_contributions]");
    expect(output.content).toContain("result-cruise,case-cruise,2,tail,0.1,0.01,0.02,0,0.03");
    expect(output.content).toContain("[static_stability]");
    expect(output.content).toContain("result_id,case_id,alpha_deg,cg_x_m,cg_z_m,cr_beta_per_rad,cy_beta_per_rad,cn_beta_per_rad");
    expect(output.content).toContain("result-cruise,case-cruise,2,0.4,-0.2,-0.15,0.3,0.09");
  });
  it("exports only selected results as UTF-8 BOM CSV with fixed columns and precision", async () => {
    const output = await analysisResultExporter.export({
      results: [result, { ...result, id: "result-other", caseId: "case-other", rows: [] }],
      selectedResultIds: [result.id],
      designName: "Long Range UAV",
    });

    expect(output.fileName).toBe("long-range-uav-analysis-results.csv");
    expect(output.mimeType).toBe("text/csv;charset=utf-8");
    expect(output.content).toBe("\uFEFFcase_id,result_id,status,alpha_deg,cl,cd,cm,ld\r\ncase-cruise,result-cruise,completed,2.0,0.9877,0.023456,-0.0346,42.35\r\n");
  });

  it("exports selected result JSON and a design summary with the same metrics", async () => {
    const output = await analysisResultExporter.exportJson({ results: [result], selectedResultIds: [result.id], designName: "Long Range UAV" });

    expect(output.fileName).toBe("long-range-uav-analysis-results.json");
    expect(JSON.parse(output.content)).toEqual([result]);
    expect(createDesignSummary({ name: "Long Range UAV", analysisCases: [{ id: "case-cruise", name: "Cruise", status: "completed" }], analysisResults: [result] })).toContain("Cruise: CLmax 1.235 / 最大 L/D 42.35");
  });

  it("appends aerodynamic span distributions to CSV output", async () => {
    const spanwise = {
      axis: { key: "semi-span" as const, unit: "m" as const },
      reference: { side: "right" as const, origin: "centerline" as const, alphaDegrees: 2, speed: 20, density: 1.225, elasticAxisChordFraction: 0.35 },
      samples: [{ position: 0.5, values: { stationWidth: 1, chord: 1, circulation: 2, localLiftCoefficient: 0.8, liftPerLength: 100, inducedDragPerLength: 3, profileDragPerLength: 2, dragPerLength: 5, pitchingMomentPerLength: -1, torqueAboutElasticAxisPerLength: 4 } }],
    };
    const output = await analysisResultExporter.export({ results: [{ ...result, rows: [{ ...result.rows[0], spanwise }] }], selectedResultIds: [result.id], designName: "Wing" });

    expect(output.content).toContain("[spanwise]\r\nresult_id,case_id,alpha_deg,y_m,width_m,chord_m,circulation_m2_per_s,local_cl,lift_N_per_m,induced_drag_N_per_m,profile_drag_N_per_m,drag_N_per_m,pitching_moment_Nm_per_m,elastic_axis_torque_Nm_per_m");
    expect(output.content).toContain("result-cruise,case-cruise,2.0,0.5,1,1,2,0.8,100,3,2,5,-1,4");
  });
});
