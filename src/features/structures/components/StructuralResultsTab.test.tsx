import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StructuralAnalysisResult } from "../model/types";
import { StructuralResultsTab } from "./StructuralResultsTab";

const result = {
  id: "result-1",
  status: "completed",
  createdAt: "2026-08-19T00:00:00.000Z",
  loadCaseSnapshot: { name: "Cruise" },
  designSnapshot: { name: "Main spar" },
  summary: {
    minReserveFactor: 2.5,
    governingPosition: 0,
    governingMode: "繊維引張",
    maxDeflection: 0.003,
    maxTwist: 0.002,
    mass: 0.8,
    governingLoadCase: "Cruise",
    analysisWarnings: ["局部座屈とBrazier扁平化は完全円筒の弾性スクリーニングです。"],
  },
  points: [{
    yPosition: 0,
    distributedLoad: 100,
    shearForce: 80,
    bendingMoment: 40,
    bendingMomentCapacity: 180,
    localBucklingReserveFactor: 3.1,
    brazierReserveFactor: 4.2,
    torque: 6,
    torqueCapacity: 32,
    deflection: 0,
    rotation: 0,
    twist: 0,
    outerDiameter: 0.08,
    thickness: 0.0015,
    ei: 42_000,
    gj: 13_000,
    linearMass: 0.45,
    axialStress: 12e6,
    shearStress: 3e6,
    minReserveFactor: 2.5,
    criticalPlyId: "ply-0",
    criticalMode: "Excel準拠曲げ",
  }],
} as StructuralAnalysisResult;

afterEach(cleanup);

describe("StructuralResultsTab", () => {
  it("leads with pipe strength and stiffness before load-case response", () => {
    render(<StructuralResultsTab results={[result]} result={result} onSelectResult={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "パイプ固有特性" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "翼幅方向の曲げ強度・剛性分布" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "翼幅方向のねじり強度・剛性分布" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "荷重ケース応答" })).toBeTruthy();
  });

  it("labels the governing value as the safety factor without exposing the spreadsheet implementation", () => {
    render(<StructuralResultsTab results={[result]} result={result} onSelectResult={vi.fn()} />);

    expect(screen.getByText("最小安全率")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "安全率" })).toBeTruthy();
    expect(screen.queryByText(/Excel/)).toBeNull();
    expect(screen.getByRole("columnheader", { name: "判定" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "支配層" })).toBeNull();
  });

  it("shows the analysis scope and shell-screening limitation", () => {
    render(<StructuralResultsTab results={[result]} result={result} onSelectResult={vi.fn()} />);

    expect(screen.getByText(/Hashin初期層破壊/)).toBeTruthy();
    expect(screen.getByText(/完全円筒の弾性スクリーニング/)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "局部座屈安全率" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Brazier安全率" })).toBeTruthy();
  });
});
