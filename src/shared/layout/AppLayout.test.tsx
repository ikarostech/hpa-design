import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { JobProvider } from "../jobs/JobProvider";
import { AppLayout } from "./AppLayout";

describe("AppLayout mobile navigation", () => {
  afterEach(cleanup);

  it("opens the navigation from the header and closes it after navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <JobProvider>
          <AppLayout><p>Page content</p></AppLayout>
        </JobProvider>
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "メニューを開く" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog", { name: "メインメニュー" })).toBeNull();

    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "メインメニュー" })).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const mobileMenu = screen.getByRole("dialog", { name: "メインメニュー" });
    await user.click(within(mobileMenu).getByRole("link", { name: "設計概要" }));

    expect(screen.queryByRole("dialog", { name: "メインメニュー" })).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the open navigation with Escape", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <JobProvider>
          <AppLayout><p>Page content</p></AppLayout>
        </JobProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "メインメニュー" })).toBeNull();
  });
});
