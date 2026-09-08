import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectSchemaPage } from "./ProjectSchemaPage";

afterEach(cleanup);

describe("ProjectSchemaPage", () => {
  it("presents the generated project schema as searchable documentation", async () => {
    const user = userEvent.setup();
    render(<ProjectSchemaPage />);

    expect(screen.getByRole("heading", { name: "プロジェクトファイル仕様" })).toBeTruthy();
    expect(screen.getByText("JSON Schema Draft 2020-12")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByRole("link", { name: "JSON Schemaを開く" }).getAttribute("href")).toBe("/schemas/project.schema.json");

    await user.type(screen.getByRole("searchbox", { name: "型を検索" }), "CarbonMaterial");

    expect(screen.getByRole("button", { name: /CarbonMaterial/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /AirfoilPolar/ })).toBeNull();
  });

  it("expands a definition and follows references within the catalog", async () => {
    const user = userEvent.setup();
    render(<ProjectSchemaPage />);

    await user.click(screen.getByRole("button", { name: /DesignDocument/ }));

    expect(screen.getByText("schemaVersion")).toBeTruthy();
    expect(screen.getByText("ファイル形式のバージョン。現在は `4` 固定。")).toBeTruthy();
    const reference = screen.getByRole("button", { name: "ConceptualDesign型を表示" });
    await user.click(reference);

    expect(screen.getByRole("button", { name: /ConceptualDesign/, expanded: true })).toBeTruthy();
  });
});
