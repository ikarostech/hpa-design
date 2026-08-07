import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InspectorDrawer } from "./InspectorDrawer";

describe("InspectorDrawer", () => {
  afterEach(cleanup);
  it("renders an accessible wide drawer with header actions and footer", () => {
    const onClose = vi.fn();
    render(
      <InspectorDrawer
        open
        title="材料プロパティ"
        subtitle="T700 UD"
        closeLabel="材料プロパティを閉じる"
        backLabel="材料一覧に戻る"
        width="wide"
        onClose={onClose}
        headerActions={<button>複製</button>}
        footer={<button>保存</button>}
      >
        <p>材料入力欄</p>
      </InspectorDrawer>,
    );

    const dialog = screen.getByRole("dialog", { name: "材料プロパティ" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.className).toContain("sm:max-w-[520px]");
    expect(screen.getByText("T700 UD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "複製" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
    expect(screen.getByText("材料入力欄")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "材料一覧に戻る" }));
    fireEvent.click(screen.getByRole("button", { name: "材料プロパティを閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not render when closed and closes from the backdrop", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <InspectorDrawer open={false} title="詳細" closeLabel="詳細を閉じる" onClose={onClose}>
        本文
      </InspectorDrawer>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <InspectorDrawer open title="詳細" closeLabel="詳細を閉じる" onClose={onClose}>
        本文
      </InspectorDrawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "詳細の背景を閉じる" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
