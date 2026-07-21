import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableActionCell, TableActionHeader } from "./TableActionColumn";

describe("table action column", () => {
  it("provides a right-aligned action header and cell", () => {
    render(
      <table>
        <thead><tr><TableActionHeader /></tr></thead>
        <tbody><tr><TableActionCell>actions</TableActionCell></tr></tbody>
      </table>,
    );

    expect(screen.getByRole("columnheader", { name: "操作" }).getAttribute("scope")).toBe("col");
    expect(screen.getByRole("columnheader", { name: "操作" }).className).toContain("text-right");
    expect(screen.getByRole("cell").className).toContain("text-right");
  });
});
