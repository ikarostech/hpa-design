import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultConceptualDesign } from "../features/conceptual-design/model/conceptualDesign";
import { ConceptualDesignPage } from "./ConceptualDesignPage";

const aircraft = { span: 25, wingArea: 30 };

describe("ConceptualDesignPage", () => {
  afterEach(cleanup);

  it("edits and saves the five initial requirements", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ConceptualDesignPage conceptualDesign={createDefaultConceptualDesign()} aircraft={aircraft} onSave={onSave} />);

    expect(screen.getByRole("heading", { name: "概要設計" })).toBeTruthy();
    expect(screen.getByText("海抜 0 m / 30 ℃")).toBeTruthy();
    expect(screen.getByText("h/b")).toBeTruthy();
    expect(screen.getByText("0.0400")).toBeTruthy();

    const speed = screen.getByLabelText("設計巡航速度");
    await user.clear(speed);
    await user.type(speed, "9.5");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      grossMass: 100,
      cruiseSpeed: 9.5,
      maximumWingspan: 30,
      groundHeight: 1,
      sustainablePower: 250,
    }));
  });

  it("does not save invalid requirements", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ConceptualDesignPage conceptualDesign={createDefaultConceptualDesign()} aircraft={aircraft} onSave={onSave} />);

    const mass = screen.getByLabelText("設計総重量");
    await user.clear(mass);
    await user.type(mass, "0");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
