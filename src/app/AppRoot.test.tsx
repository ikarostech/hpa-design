import { render, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ApplicationRouter } from "./AppRoot";

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

describe("ApplicationRouter", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("restores an application route from the URL hash", () => {
    window.location.hash = "#/analysis?tab=results";

    render(<ApplicationRouter><LocationProbe /></ApplicationRouter>);

    expect(screen.getByText("/analysis?tab=results")).toBeTruthy();
  });
});
