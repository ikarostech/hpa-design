import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(cleanup);

  it("stays fixed below the header while the page scrolls", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);

    const sidebar = screen.getByRole("complementary");
    expect(sidebar.className).toContain("sticky");
    expect(sidebar.className).toContain("top-16");
    expect(sidebar.className).toContain("h-[calc(100vh-4rem)]");
    expect(sidebar.className).toContain("overflow-y-auto");
  });

  it("presents aerodynamic, structural, and FSI design domains as peer pages", () => {
    render(<MemoryRouter initialEntries={["/fsi"]}><Sidebar /></MemoryRouter>);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["設計概要", "/"],
      ["概要設計", "/conceptual-design"],
      ["空力設計", "/aerodynamics/airfoils"],
      ["構造設計", "/structures"],
      ["空力・構造連成（FSI）", "/fsi"],
      ["入出力", "/export"],
      ["ファイル仕様", "/schema"],
    ]);
    expect(screen.getByRole("link", { name: "空力・構造連成（FSI）" }).className).toContain("bg-blue-50");
    expect(screen.getByRole("link", { name: "空力設計" }).className).not.toContain("bg-blue-50");
  });

  it("places conceptual design between the dashboard and aerodynamic design", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);

    const links = screen.getAllByRole("link");
    expect(links.slice(0, 3).map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["設計概要", "/"],
      ["概要設計", "/conceptual-design"],
      ["空力設計", "/aerodynamics/airfoils"],
    ]);
  });
});
