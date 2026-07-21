import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

describe("DeleteConfirmationDialog", () => {
  it("explains a deletion blocker and prevents confirmation while retaining cancellation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        open
        title="翼型A を削除しますか？"
        description="この操作は元に戻せません。"
        blockedReason="この翼型は主翼から参照されているため削除できません。"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("alertdialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("この翼型は主翼から参照されているため削除できません。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "削除する" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
