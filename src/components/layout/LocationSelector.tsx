"use client";

import { useEffect, useState } from "react";
import { HeaderActionButton, HeaderModal } from "./HeaderActionModal";

const STORAGE_KEY = "handyman:selectedLocation";

/**
 * Frontend-only location selector (Phase 4 frontend-polish scope). No
 * service-area data exists yet (REQUIREMENTS_ANALYSIS.md §7 lists
 * service-area cities as missing), so this is a free-text field rather
 * than a fabricated city list, per the explicit "Enter your location"
 * fallback. Selection is stored only in the browser (localStorage) —
 * there is no backend.
 */
export function LocationSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // One-time hydration of client-only browser storage into state on mount;
      // there is no external subscription to synchronize (localStorage has none),
      // so this intentionally runs once rather than modeling a subscription.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setLocation(saved);
    } catch {
      // localStorage unavailable (private browsing, etc.) — feature just degrades silently
    }
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setLocation(trimmed);
    try {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  return (
    <>
      <HeaderActionButton
        icon="map-pin"
        label={location ? `Location: ${location}` : "Select your location"}
        className={className}
        onClick={() => {
          setDraft(location);
          setOpen(true);
        }}
      />
      <HeaderModal open={open} onClose={() => setOpen(false)} title="Select your location">
        <form onSubmit={handleSave}>
          <label htmlFor="location-input" className="mb-1.5 block text-sm font-medium text-neutral-800">
            Enter your location
          </label>
          <input
            id="location-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. your city or area"
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Save location
          </button>
        </form>
      </HeaderModal>
    </>
  );
}
