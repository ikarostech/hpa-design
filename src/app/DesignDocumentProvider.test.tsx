import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DesignDocumentProvider, useDesignDocument } from "./DesignDocumentProvider";

describe("DesignDocumentProvider", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("uses the anonymized HPA reference as the default project when no recovery exists", () => {
    render(<DesignDocumentProvider><DocumentProbe /></DesignDocumentProvider>);

    expect(screen.getByTestId("name").textContent).toBe("匿名化 HPA 参照設計（保存済み解析結果）");
    expect(screen.getByTestId("results").textContent).toBe("2 / 1");
  });

  it("exposes conceptual design updates to application routes", async () => {
    const user = userEvent.setup();
    render(<DesignDocumentProvider><DocumentProbe /></DesignDocumentProvider>);

    await user.click(screen.getByRole("button", { name: "巡航速度を更新" }));

    expect(screen.getByTestId("cruise-speed").textContent).toBe("9.5");
  });
});

function DocumentProbe() {
  const { document, updateConceptualDesign } = useDesignDocument();
  return <>
    <span data-testid="name">{document.name}</span>
    <span data-testid="results">{document.analysisResults.length} / {document.structuralResults.length}</span>
    <span data-testid="cruise-speed">{document.conceptualDesign?.cruiseSpeed}</span>
    <button onClick={() => updateConceptualDesign({ ...document.conceptualDesign!, cruiseSpeed: 9.5 })}>巡航速度を更新</button>
  </>;
}
