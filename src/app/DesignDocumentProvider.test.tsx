import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DesignDocumentProvider, useDesignDocument } from "./DesignDocumentProvider";

describe("DesignDocumentProvider", () => {
  beforeEach(() => window.localStorage.clear());

  it("uses the aero-structural sample as the default project when no recovery exists", () => {
    render(<DesignDocumentProvider><DocumentProbe /></DesignDocumentProvider>);

    expect(screen.getByTestId("name").textContent).toBe("HPADesign 空力・構造 MVP サンプル");
    expect(screen.getByTestId("results").textContent).toBe("1 / 1");
  });
});

function DocumentProbe() {
  const { document } = useDesignDocument();
  return <>
    <span data-testid="name">{document.name}</span>
    <span data-testid="results">{document.analysisResults.length} / {document.structuralResults.length}</span>
  </>;
}
