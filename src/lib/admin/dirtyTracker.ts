/**
 * Framework-free core of the Homepage Content "unsaved changes" registry.
 *
 * `setDirty` is idempotent: it calls `onChange` ONLY when the set of dirty
 * sections (or a section's label) actually changed. The previous registry
 * notified on every call -- including "section X is still clean" -- and its
 * identity changed whenever the parent re-rendered, so every section
 * re-registered, which notified the parent, which re-rendered, which ...
 * ("Maximum update depth exceeded").
 */
export interface DirtyTracker {
  setDirty: (id: string, dirty: boolean, label: string) => void;
  /** Swap the listener without changing the tracker's identity. */
  setOnChange: (onChange: (anyDirty: boolean, labels: string[]) => void) => void;
}

export function createDirtyTracker(initialOnChange: (anyDirty: boolean, labels: string[]) => void): DirtyTracker {
  const dirty = new Map<string, string>();
  let onChange = initialOnChange;
  return {
    setOnChange(next) {
      onChange = next;
    },
    setDirty(id, isDirty, label) {
      if (isDirty) {
        if (dirty.get(id) === label) return;
        dirty.set(id, label);
      } else {
        if (!dirty.delete(id)) return;
      }
      onChange(dirty.size > 0, Array.from(dirty.values()));
    },
  };
}
