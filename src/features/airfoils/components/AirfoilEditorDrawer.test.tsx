import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AirfoilEditorDrawer } from "./AirfoilEditorDrawer";

describe("AirfoilEditorDrawer", () => {
  afterEach(cleanup);
  it("creates a valid NACA airfoil and saves the preview", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AirfoilEditorDrawer mode="create-naca" open airfoil={undefined} onClose={vi.fn()} onSave={onSave} />);
    await user.clear(screen.getByPlaceholderText("2412"));
    await user.type(screen.getByPlaceholderText("2412"), "2412");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "NACA2412" }));
  });

  it("closes without saving when cancelled", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AirfoilEditorDrawer mode="create-naca" open airfoil={undefined} onClose={onClose} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
