import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobProvider } from "../jobs/JobProvider";
import { Header } from "./Header";
import { version } from "../../../package.json";

describe("Header", () => {
  afterEach(cleanup);

  it("shows public product branding without development or personal account labels", () => {
    render(<JobProvider><Header /></JobProvider>);

    expect(screen.getByText("HPADesign")).toBeTruthy();
    expect(screen.queryByText(/MVP/i)).toBeNull();
    expect(screen.queryByText("Ikaro")).toBeNull();
    expect(screen.queryByText("IK")).toBeNull();
  });

  it("shows the current package version beside the product name", () => {
    render(<JobProvider><Header /></JobProvider>);

    expect(screen.getByText("HPADesign").parentElement?.textContent).toContain(`v${version}`);
  });
});
