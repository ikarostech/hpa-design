import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { FormState } from "../../../shared/model";
import type { TailSurface } from "./types";

type TailDraftForm = Pick<FormState<TailSurface[]>, "initialValue" | "value" | "dirty"> & {
  setValue: Dispatch<SetStateAction<TailSurface[]>>;
};
const TailDraftContext = createContext<TailDraftForm | null>(null);

/** Lives above routes so navigation never commits or discards a tail draft. */
export function TailDesignDraftProvider({ savedSurfaces, children }: { savedSurfaces: TailSurface[]; children: ReactNode }) {
  const form = useDraftForm(savedSurfaces, true);
  return <TailDraftContext.Provider value={form}>{children}</TailDraftContext.Provider>;
}

export function useTailDesignDraft(savedSurfaces: TailSurface[]) {
  const context = useContext(TailDraftContext);
  const local = useDraftForm(savedSurfaces, context === null);
  return context ?? local;
}

function useDraftForm(savedSurfaces: TailSurface[], warnOnUnload: boolean): TailDraftForm {
  const [draft, setDraft] = useState({ initialValue: savedSurfaces, value: savedSurfaces });
  // The document store returns clones. Compare saved values, not object identity.
  const current = JSON.stringify(draft.initialValue) === JSON.stringify(savedSurfaces)
    ? draft : { initialValue: savedSurfaces, value: savedSurfaces };
  if (current !== draft) setDraft(current);
  const dirty = JSON.stringify(current.value) !== JSON.stringify(savedSurfaces);
  useEffect(() => {
    if (!warnOnUnload || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, warnOnUnload]);
  return { ...current, dirty, setValue: (next) => setDraft({ initialValue: savedSurfaces,
    value: typeof next === "function" ? next(current.value) : next,
  }) };
}
