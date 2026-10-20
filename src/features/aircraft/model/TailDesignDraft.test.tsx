import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TailDesignDraftProvider, useTailDesignDraft } from "./TailDesignDraft";
import type { TailSurface } from "./types";

afterEach(cleanup);

const saved: TailSurface[] = [{ id: "tail", name: "Tail", orientation: "horizontal",
  rootPosition: { x: 4, y: 0, z: 0 }, incidence: 0, symmetric: true,
  isDoubleFin: false, isSymmetricFin: false, sections: [],
}];

function Editor() {
  const form = useTailDesignDraft(saved);
  return <input aria-label="incidence" type="number" value={form.value[0].incidence}
    onChange={(event) => form.setValue(form.value.map((surface) => ({ ...surface, incidence: Number(event.target.value) })))} />;
}

it("discards obsolete drafts when the saved design changes, even if a previous design is restored", () => {
  const { rerender } = render(<TailDesignDraftProvider savedSurfaces={saved}><Editor /></TailDesignDraftProvider>);
  fireEvent.change(screen.getByLabelText("incidence"), { target: { value: "7" } });
  rerender(<TailDesignDraftProvider savedSurfaces={saved.map((surface) => ({ ...surface }))}><Editor /></TailDesignDraftProvider>);
  expect((screen.getByLabelText("incidence") as HTMLInputElement).value).toBe("7");
  rerender(<TailDesignDraftProvider savedSurfaces={saved.map((surface) => ({ ...surface, incidence: 2 }))}><Editor /></TailDesignDraftProvider>);
  expect((screen.getByLabelText("incidence") as HTMLInputElement).value).toBe("2");
  rerender(<TailDesignDraftProvider savedSurfaces={saved}><Editor /></TailDesignDraftProvider>);
  expect((screen.getByLabelText("incidence") as HTMLInputElement).value).toBe("0");
});
