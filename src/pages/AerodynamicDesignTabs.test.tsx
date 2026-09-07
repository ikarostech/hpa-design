import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AerodynamicDesignTabs } from "./AerodynamicDesignTabs";

afterEach(cleanup);

describe("AerodynamicDesignTabs", () => {
  it("keeps airfoils, wing geometry, and rigid-wing analysis in one aerodynamic design page", () => {
    render(<MemoryRouter initialEntries={["/aerodynamics/geometry"]}><AerodynamicDesignTabs /></MemoryRouter>);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("href")])).toEqual([
      ["翼型", "/aerodynamics/airfoils"],
      ["主翼形状", "/aerodynamics/geometry"],
      ["空力解析", "/aerodynamics/analysis"],
    ]);
    expect(screen.getByRole("tab", { name: "主翼形状" }).getAttribute("aria-selected")).toBe("true");
  });
});
