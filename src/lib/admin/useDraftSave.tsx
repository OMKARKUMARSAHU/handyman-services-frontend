"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createDirtyTracker, type DirtyTracker } from "./dirtyTracker";

/**
 * Shared staged-draft/Done-Save/Cancel infrastructure for the Homepage
 * Content admin panel (HOMEPAGE ADMIN REBUILD, Step 5 — "uploads saved
 * only after Done/Save," explicitly called out as CRITICAL).
 *
 * Every section editor in AdminHomepageContentPanel.tsx is built on
 * `useDraftSave`: it holds a local, in-memory draft that is never sent to
 * the server until `save()` is called, and can always be thrown away with
 * `cancel()` to restore whatever was last actually saved. Nothing here is
 * a "frontend-only illusion" — the one thing the draft can refer to that
 * IS already committed server-side the moment it's picked is a Media
 * Library asset (`MediaPickerField`/`MediaPicker`'s "Upload New Media"
 * tab calls the existing `/admin/media-library` upload flow immediately,
 * same as every other media field in this project) — but an uploaded
 * asset becoming a reusable Library item is not the same thing as it
 * becoming part of the live homepage. The live homepage only ever reads
 * `homepage_sections`/`branding`/`contact_info` rows, and this hook is
 * what guarantees a draft never reaches those tables except through an
 * explicit, successful `save()`. A picked-but-never-saved media item
 * simply stays in the Media Library, unattached — visible and reusable
 * there, never deleted automatically (the Library's own existing
 * "still in use" / manual delete-or-deactivate flow, built in the prior
 * Media Library phase, is what already governs cleanup of anything
 * unattached; see claude/phase-11-media-library-implementation-and-
 * verification-checklist.md item 9's explicit "removing an attachment
 * must not delete the shared object" rule, which cuts both ways — never
 * attaching it in the first place is the same safe state).
 */

export type DraftSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------
// Dirty registry — lets the panel's outer shell know "is ANY section
// mid-edit right now," so it can warn before switching Admin Dashboard
// tabs away from Homepage Content, without every section needing to know
// about every other one.
// ---------------------------------------------------------------------

interface DirtyRegistryContextValue {
  setDirty: (id: string, dirty: boolean, label: string) => void;
}

const DirtyRegistryContext = createContext<DirtyRegistryContextValue | null>(null);

/**
 * The context value is created ONCE and never changes identity: `onChange`
 * is swapped in an effect (the tracker keeps its identity), so a parent that passes a new inline callback every
 * render can no longer cause every section to re-register (the cause of the
 * "Maximum update depth exceeded" loop), and the tracker only notifies when
 * the dirty set really changes (see dirtyTracker.ts).
 */
export function DirtyRegistryProvider({
  children,
  onChange,
}: {
  children: React.ReactNode;
  onChange: (anyDirty: boolean, dirtyLabels: string[]) => void;
}) {
  const [value] = useState<DirtyTracker>(() => createDirtyTracker(onChange));
  // Always notify the latest callback without changing the (stable) context value.
  useEffect(() => {
    value.setOnChange(onChange);
  }, [value, onChange]);

  return <DirtyRegistryContext.Provider value={value}>{children}</DirtyRegistryContext.Provider>;
}

/** Warns before an in-page browser navigation/close/refresh while anything is unsaved (Step 5 — "Prevent accidental loss of unsaved changes when switching sections or navigating away"). Tab/section switches inside the panel are guarded separately, by whoever calls `save`/`cancel`/confirms via the dirty registry above. */
export function useBeforeUnloadGuard(anyDirty: boolean) {
  useEffect(() => {
    if (!anyDirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);
}

// ---------------------------------------------------------------------
// useDraftSave
// ---------------------------------------------------------------------

export interface UseDraftSaveResult<T> {
  /** The current, possibly-unsaved, in-memory value — bind every input in the section to this, never directly to the server value. */
  draft: T;
  /** Replace the draft (object form, or an updater function like React's setState). Never touches the server. */
  setDraft: (next: T | ((prev: T) => T)) => void;
  /** True whenever `draft` differs from the last successfully-saved value. */
  dirty: boolean;
  status: DraftSaveStatus;
  /** Set only when `status === "error"` — the real message from the failed save, never a swallowed/pretend success. */
  error: string | null;
  /** Commits the draft via the caller's `onSave`. Resolves only after the server confirms; on failure the draft is left exactly as the admin had it (never cleared/reset) so nothing already typed is lost, and `error`/`status` reflect the real failure. */
  save: () => Promise<void>;
  /** Discards the draft, restoring the last successfully-saved value — the explicit "Cancel/Back" affordance Step 5 requires. */
  cancel: () => void;
}

/**
 * @param id Stable identity for this section's slot in the dirty registry (e.g. "whyChooseUs", "video-curations"). Unused outside that bookkeeping.
 * @param label Human-readable name shown in the "you have unsaved changes in: …" summary.
 * @param serverValue The latest known-saved value from the server. Re-syncs the draft baseline whenever this changes identity AND the section isn't currently dirty (so a background refetch never silently clobbers an in-progress edit).
 * @param onSave Called with the current draft when the admin clicks Save. Must throw (or reject) on failure — `save()` relies on that to know not to clear `dirty`.
 */
export function useDraftSave<T>(id: string, label: string, serverValue: T, onSave: (draft: T) => Promise<void>): UseDraftSaveResult<T> {
  const registry = useContext(DirtyRegistryContext);
  const [baseline, setBaseline] = useState<T>(serverValue);
  const [draft, setDraftState] = useState<T>(serverValue);
  const [status, setStatus] = useState<DraftSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const signature = stableStringify(serverValue);
  const [lastServerSignature, setLastServerSignature] = useState(signature);

  const dirty = stableStringify(draft) !== stableStringify(baseline);

  // Re-sync from the server when it actually changed AND there's no local
  // in-progress edit to protect — e.g. right after the section's first
  // load, or after another admin/tab's save. Never overwrites an active,
  // unsaved edit out from under the admin. Deliberately done here, during
  // render (React's documented "adjusting state when a prop changes"
  // pattern — see react.dev/learn/you-might-not-need-an-effect), rather
  // than in a useEffect: an effect that calls setState unconditionally on
  // every change is flagged by this project's react-hooks/set-state-in-
  // effect lint rule as a needless extra render, and the adjust-during-
  // render form is the rule's own recommended fix.
  if (signature !== lastServerSignature) {
    setLastServerSignature(signature);
    if (!dirty) {
      setBaseline(serverValue);
      setDraftState(serverValue);
      setStatus("idle");
      setError(null);
    }
  }

  // Report the dirty state when it (or the label) changes. `registry` is
  // stable for the life of the panel, and the tracker ignores repeats, so
  // this effect can never ping-pong with the parent.
  useEffect(() => {
    registry?.setDirty(id, dirty, label);
  }, [dirty, id, label, registry]);
  // Forget this section only when it goes away (unmount / id change) --
  // not on every dirty flip, which used to emit a spurious "clean" first.
  useEffect(() => {
    return () => registry?.setDirty(id, false, "");
  }, [id, registry]);

  const setDraft = useCallback((next: T | ((prev: T) => T)) => {
    setDraftState((prev) => (typeof next === "function" ? (next as (p: T) => T)(prev) : next));
    setStatus((s) => (s === "saving" ? s : "dirty"));
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setDraftState(baseline);
    setStatus("idle");
    setError(null);
  }, [baseline]);

  const save = useCallback(async () => {
    setStatus("saving");
    setError(null);
    try {
      await onSave(draft);
      setBaseline(draft);
      setLastServerSignature(stableStringify(draft));
      setStatus("saved");
    } catch (err) {
      // Deliberately does NOT reset draft/baseline — Step 5: "If saving
      // fails, preserve the draft and show a clear error instead of
      // pretending the save succeeded."
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save this section. Please try again.");
      throw err;
    }
  }, [draft, onSave]);

  return { draft, setDraft, dirty, status, error, save, cancel };
}
