import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { StabilityShape } from "../model/types";
import { StabilityShapeEditor } from "./StabilityShapeEditor";

afterEach(cleanup);
describe("StabilityShapeEditor", () => {
  it("edits a manual half-span distribution, including negative twist, and confirms point deletion", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [shape, setShape] = useState<StabilityShape>({ kind: "rigid" });
      return <><StabilityShapeEditor shape={shape} semiSpan={2} defaultAxis={0.35} fsiShapes={[]} onChange={setShape} />
        <output aria-label="形状データ">{JSON.stringify(shape)}</output></>;
    }
    render(<Harness />);
    await user.selectOptions(screen.getByRole("combobox", { name: "評価形状" }), "manual");
    await user.clear(screen.getByRole("spinbutton", { name: "点2 たわみ (m)" }));
    await user.type(screen.getByRole("spinbutton", { name: "点2 たわみ (m)" }), "0.3");
    await user.clear(screen.getByRole("spinbutton", { name: "点2 ねじり (°)" }));
    await user.type(screen.getByRole("spinbutton", { name: "点2 ねじり (°)" }), "-2");
    expect(JSON.parse(screen.getByLabelText("形状データ").textContent!).points[1]).toMatchObject({ deflection: 0.3, twist: -2 });
    await user.click(screen.getByRole("button", { name: "分布点を追加" }));
    expect(screen.getByRole("spinbutton", { name: "点3 たわみ (m)" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "点2を削除" }));
    expect(screen.getByRole("alertdialog", { name: "分布点を削除しますか？" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "削除する" }));
    expect(JSON.parse(screen.getByLabelText("形状データ").textContent!).points).toHaveLength(2);
  });
});
