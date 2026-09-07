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

    expect(await screen.findByRole("heading", { name: "空力・構造連成（FSI）" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "連成解析を実行" })).toBeTruthy();
  });
});
