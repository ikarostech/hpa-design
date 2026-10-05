import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ApplicationRouter } from "./AppRoot";
import { createDefaultDesignDocument } from "./defaultDesignDocument";
import { WORKING_DOCUMENT_ID } from "./designDocumentRecoveryRepository";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("App routes", () => {
  it("opens the coupled FSI workspace at its dedicated route", async () => {
    window.location.hash = "#/fsi";

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "空力・構造連成（FSI）" }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成解析を実行" })).toBeTruthy();
    expect(screen.getByText(/翼端たわみが半翼長の10%を超えており/)).toBeTruthy();
    expect(screen.getByText("推定 L/D").parentElement?.textContent).toContain("28.63");
    expect(screen.getByRole("img", { name: "FSI 翼幅方向の揚力分布" })).toBeTruthy();
  });

  it("redirects the retired schema viewer route to the dashboard", async () => {
    window.location.hash = "#/schema";

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "設計概要" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "プロジェクトファイル仕様" })).toBeNull();
  });

  it("opens tail design on its own aerodynamic-design route", async () => {
    window.location.hash = "#/aerodynamics/tails";

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "尾翼設計" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "尾翼設計" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "尾翼を追加" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "エレベーター", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ラダー", level: 2 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "エレベーターを単体解析" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ラダーを単体解析" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "エレベーター section 1 right foil" }) as HTMLSelectElement).selectedOptions[0].textContent).toBe("NACA0042");
    expect((screen.getByRole("combobox", { name: "ラダー section 1 right foil" }) as HTMLSelectElement).selectedOptions[0].textContent).toBe("NACA0042");
    expect(screen.queryByRole("heading", { name: "エレベーターの単体解析" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "ラダーの単体解析" })).toBeNull();
  });

  it("shows recovered sample tail geometry without standalone analysis", async () => {
    const storage = new MemoryStorage();
    vi.spyOn(window, "localStorage", "get").mockReturnValue(storage);
    const sample = createDefaultDesignDocument();
    const wholeAircraftCase = sample.analysisCases.find((analysisCase) => analysisCase.scope === "aircraft")!;
    window.localStorage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: {
        ...sample,
        analysisCases: sample.analysisCases.filter((analysisCase) => analysisCase.id !== wholeAircraftCase.id),
        analysisResults: sample.analysisResults.filter((result) => result.caseId !== wholeAircraftCase.id),
      },
      isDirty: false,
      sampleTailRevision: 4,
    }));
    window.location.hash = "#/aerodynamics/tails";

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "エレベーター", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ラダー", level: 2 })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "エレベーターの単体解析" })).toBeNull();
  });

  it("shows the new sample tail sections alongside an older recovered edit", async () => {
    const storage = new MemoryStorage();
    vi.spyOn(window, "localStorage", "get").mockReturnValue(storage);
    const sample = createDefaultDesignDocument();
    const manualTail = { ...sample.aircraft.tailSurfaces![0], id: "manual-tail", name: "手動の水平尾翼" };
    window.localStorage.setItem(WORKING_DOCUMENT_ID, JSON.stringify({
      document: { ...sample, aircraft: { ...sample.aircraft, tailSurfaces: [manualTail] } },
      isDirty: true,
    }));
    window.location.hash = "#/aerodynamics/tails";

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "エレベーター", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ラダー", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "手動の水平尾翼", level: 2 })).toBeTruthy();
    expect(screen.getByText("3 面")).toBeTruthy();
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
