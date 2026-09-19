import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";
import { ApplicationRouter } from "./AppRoot";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = "";
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
});
