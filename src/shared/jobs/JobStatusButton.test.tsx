import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { JobProvider } from "./JobProvider";
import { JobStatusButton } from "./JobStatusButton";

describe("JobStatusButton", () => {
  it("shows the empty job states when opened", async () => {
    const user = userEvent.setup();
    render(<JobProvider><JobStatusButton /></JobProvider>);

    await user.click(screen.getByRole("button", { name: "ジョブ" }));

    expect(screen.getByText("実行中のジョブはありません")).toBeTruthy();
    expect(screen.getByText("最近のジョブはありません")).toBeTruthy();
  });
});
