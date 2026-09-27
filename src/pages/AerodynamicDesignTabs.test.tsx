import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

afterEach(cleanup);

describe("AerodynamicDesignTabs", () => {
  it("provides tail design as a separate aerodynamic-design tab", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/tails"]}><AerodynamicDesignTabs /></MemoryRouter>);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("href")])).toEqual([
      ["翼型", "/aerodynamics/airfoils"],
      ["主翼形状", "/aerodynamics/geometry"],
      ["尾翼設計", "/aerodynamics/tails"],
      ["空力解析", "/aerodynamics/analysis"],
    ]);
    expect(screen.getByRole("tab", { name: "尾翼設計" }).getAttribute("aria-selected")).toBe("true");
  });
});
