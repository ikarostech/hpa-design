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

  it("marks only the result link active when the analysis result query is selected", () => {
    render(<MemoryRouter initialEntries={["/analysis?tab=results"]}><Sidebar /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "結果" }).className).toContain("bg-blue-50");
    expect(screen.getByRole("link", { name: "解析" }).className).not.toContain("bg-blue-50");
  });
});
