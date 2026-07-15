import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("marks only the result link active when the analysis result query is selected", () => {
    render(<MemoryRouter initialEntries={["/analysis?tab=results"]}><Sidebar /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "結果" }).className).toContain("bg-blue-50");
    expect(screen.getByRole("link", { name: "解析" }).className).not.toContain("bg-blue-50");
  });
});
