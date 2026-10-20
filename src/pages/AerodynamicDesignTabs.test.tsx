import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

afterEach(cleanup);

describe("AerodynamicDesignTabs", () => {
  it("keeps aerodynamic tabs focused on airfoils and the main wing", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><AerodynamicDesignTabs /></MemoryRouter>);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("href")])).toEqual([
      ["翼型", "/aerodynamics/airfoils"],
      ["主翼設計", "/aerodynamics/geometry"],
      ["主翼解析", "/aerodynamics/analysis"],
    ]);
    expect(screen.queryByRole("tab", { name: "尾翼設計" })).toBeNull();
  });
});
