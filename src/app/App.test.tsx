import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ApplicationRouter } from "./AppRoot";
import { createDefaultDesignDocument } from "./defaultDesignDocument";
import { WORKING_DOCUMENT_ID } from "./designDocumentRecoveryRepository";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("App routes", () => {
  it("automatically applies tail edits and retains them across tab and navigation changes", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "localStorage", "get").mockReturnValue(new MemoryStorage());
    window.location.hash = "#/stability/tails";
    render(<ApplicationRouter><App /></ApplicationRouter>);
    await screen.findByRole("heading", { name: "尾翼設計" }, { timeout: 10_000 });
    const incidence = screen.getAllByRole("spinbutton", { name: "取付角 (°)" })[0];
    await user.clear(incidence);
    await user.type(incidence, "7");
    await user.click(screen.getByRole("button", { name: "尾翼を追加" }));
    await user.click(screen.getByRole("tab", { name: "安定性解析" }));
    await screen.findByRole("heading", { name: "安定性設計" }, { timeout: 10_000 });
    await user.click(screen.getByRole("tab", { name: "尾翼設計" }));
    await screen.findByRole("heading", { name: "尾翼設計" }, { timeout: 10_000 });
    expect((screen.getAllByRole("spinbutton", { name: "取付角 (°)" })[0] as HTMLInputElement).value).toBe("7");
    expect(screen.getAllByRole("spinbutton", { name: "取付角 (°)" })).toHaveLength(3);
    await user.click(screen.getByRole("link", { name: "設計概要" }));
    await screen.findByRole("heading", { name: "設計概要" }, { timeout: 10_000 });
    const unloadWhileAway = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloadWhileAway);
    expect(unloadWhileAway.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("link", { name: "安定性設計" }));
    await screen.findByRole("heading", { name: "安定性設計" }, { timeout: 10_000 });
    await user.click(screen.getByRole("tab", { name: "尾翼設計" }));
    await screen.findByRole("heading", { name: "尾翼設計" }, { timeout: 10_000 });
    expect((screen.getAllByRole("spinbutton", { name: "取付角 (°)" })[0] as HTMLInputElement).value).toBe("7");
    expect(screen.queryByRole("button", { name: "キャンセル" })).toBeNull();
    expect(screen.queryByRole("button", { name: "尾翼設計を保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "安定性解析に進む" })).toBeNull();
    expect(screen.getAllByRole("spinbutton", { name: "取付角 (°)" })).toHaveLength(3);
    const recovered = JSON.parse(window.localStorage.getItem(WORKING_DOCUMENT_ID)!);
    expect(recovered.document.aircraft.tailSurfaces[0].incidence).toBe(7);
    expect(recovered.document.aircraft.tailSurfaces).toHaveLength(3);
  }, 20_000);
  it.each(["/stability", "/aerodynamics/stability"])("opens standalone stability design from %s and retains aircraft cases", async (path) => {
    window.location.hash = `#${path}`;
    render(<ApplicationRouter><App /></ApplicationRouter>);
    expect(await screen.findByRole("heading", { name: "安定性設計" }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "空力設計" })).toBeNull();
    expect(window.location.hash).toBe("#/stability");
    expect(screen.getByRole("link", { name: "安定性設計" }).getAttribute("aria-current")).toBe("page");
    const savedCase = createDefaultDesignDocument().analysisCases.find((item) => item.scope === "aircraft")!;
    expect(screen.getByRole("button", { name: `${savedCase.name}を詳細表示` })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "尾翼設計" }).getAttribute("href")).toContain("/stability/tails");
  }, 15_000);
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

  it.each(["/stability/tails", "/aerodynamics/tails"])("opens tail design in stability design from %s", async (path) => {
    window.location.hash = `#${path}`;

    render(<ApplicationRouter><App /></ApplicationRouter>);

    expect(await screen.findByRole("heading", { name: "尾翼設計" }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "尾翼設計" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tablist", { name: "空力設計" })).toBeNull();
    expect(window.location.hash).toBe("#/stability/tails");
    expect(screen.getByRole("button", { name: "尾翼を追加" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "エレベーター", level: 2 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ラダー", level: 2 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "エレベーターを単体解析" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ラダーを単体解析" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "エレベーター section 1 right foil" }) as HTMLSelectElement).selectedOptions[0].textContent).toBe("NACA0042");
    expect((screen.getByRole("combobox", { name: "ラダー section 1 right foil" }) as HTMLSelectElement).selectedOptions[0].textContent).toBe("NACA0042");
    expect(screen.queryByRole("heading", { name: "エレベーターの単体解析" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "ラダーの単体解析" })).toBeNull();
  }, 15_000);

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
