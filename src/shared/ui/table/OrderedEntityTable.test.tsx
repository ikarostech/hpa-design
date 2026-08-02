import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderedEntityTable } from "./OrderedEntityTable";

const items = [
  { id: "first", name: "先頭" },
  { id: "second", name: "末尾" },
];

describe("OrderedEntityTable", () => {
  afterEach(cleanup);

  it("uses the selected item for before and after insertion while keeping row selection separate", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onInsertBefore = vi.fn();
    const onInsertAfter = vi.fn();

    render(
      <OrderedEntityTable
        title="順序項目"
        itemLabel="項目"
        items={items}
        columns={[{ key: "name", header: "名前", renderCell: (item) => item.name }]}
        getKey={(item) => item.id}
        getRowLabel={(item) => item.name}
        selectedKey="second"
        onSelect={onSelect}
        insertBefore={{ onAction: onInsertBefore }}
        insertAfter={{ onAction: onInsertAfter }}
        renderActions={(item) => <button>{item.name}の操作</button>}
      />,
    );

    expect(screen.getByRole("row", { name: "末尾" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("columnheader", { name: "操作" }).className).toContain("text-right");
    expect(screen.getByRole("button", { name: "末尾の操作" }).closest("td")?.className).toContain("text-right");
    await user.click(screen.getByRole("button", { name: "前に項目を追加" }));
    await user.click(screen.getByRole("button", { name: "後ろに項目を追加" }));
    await user.click(screen.getByRole("row", { name: "先頭" }));

    expect(onInsertBefore).toHaveBeenCalledWith("second");
    expect(onInsertAfter).toHaveBeenCalledWith("second");
    expect(onSelect).toHaveBeenCalledWith("first");
  });

  it("disables relative insertion without a selection and renders an empty state", () => {
    render(
      <OrderedEntityTable
        title="順序項目"
        itemLabel="項目"
        items={[]}
        columns={[]}
        getKey={(item: { id: string }) => item.id}
        getRowLabel={() => "項目"}
        selectedKey={null}
        onSelect={vi.fn()}
        insertBefore={{ onAction: vi.fn() }}
        insertAfter={{ onAction: vi.fn() }}
      />,
    );

    expect((screen.getByRole("button", { name: "前に項目を追加" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "後ろに項目を追加" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("項目がありません。")).toBeTruthy();
  });
});
