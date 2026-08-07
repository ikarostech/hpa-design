import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageTemplate } from "./PageTemplate";

describe("PageTemplate", () => {
  afterEach(cleanup);
  it("renders the shared page header and optional page regions", () => {
    render(
      <PageTemplate
        title="構造設計"
        description="主翼構造を編集します。"
        actions={<button>保存</button>}
        tabs={<div role="tablist">タブ</div>}
        notices={<p role="alert">入力を確認してください。</p>}
      >
        <section>ページ固有コンテンツ</section>
      </PageTemplate>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "構造設計" })).toBeTruthy();
    expect(screen.getByText("主翼構造を編集します。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("ページ固有コンテンツ")).toBeTruthy();
  });
});
