import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobProvider } from "../jobs/JobProvider";
import { Header } from "./Header";

describe("Header", () => {
  afterEach(cleanup);

  it("shows public product branding without development or personal account labels", () => {
    render(<JobProvider><Header /></JobProvider>);

    expect(screen.getByText("HPADesign")).toBeTruthy();
    expect(screen.queryByText(/MVP/i)).toBeNull();
    expect(screen.queryByText("Ikaro")).toBeNull();
    expect(screen.queryByText("IK")).toBeNull();
  });
});
