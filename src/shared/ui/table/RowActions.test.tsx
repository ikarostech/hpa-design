import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { RowActions } from "./RowActions";

describe("RowActions", () => {
  it("renders standard and custom actions in the prescribed order with entity-aware labels", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <div onClick={onRowClick}>
        <RowActions
          entityLabel="翼型A"
          detail={{ onAction: vi.fn() }}
          edit={{ onAction: onEdit }}
          rerun={{ onAction: vi.fn() }}
          custom={[{ key: "duplicate", label: "複製", icon: <Pencil size={15} />, onAction: vi.fn() }]}
          delete={{ onAction: onDelete }}
        />
      </div>,
    );

    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "翼型Aを詳細表示",
      "翼型Aを編集",
      "翼型Aを再実行",
      "翼型Aを複製",
      "翼型Aを削除",
    ]);

    await user.click(screen.getByRole("button", { name: "翼型Aを編集" }));
    await user.click(screen.getByRole("button", { name: "翼型Aを削除" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opens and closes a fixed-position export menu from one trigger", async () => {
    const user = userEvent.setup();

    render(<RowActions entityLabel="翼型A" export={{ options: [{ key: "csv", label: "CSV", onAction: vi.fn() }] }} />);

    const trigger = screen.getByRole("button", { name: "翼型Aを出力形式から選択" });
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu").className).toContain("fixed");

    await user.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
