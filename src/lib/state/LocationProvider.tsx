"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "handyman:selectedCitySlug";

interface LocationContextValue {
  /** "Last selected city" convenience value — a UX convenience layer on top of the URL, not the source of truth. See PHASE_2_SYSTEM_ARCHITECTURE.md §4. */
  lastCitySlug: string | null;
  setLastCitySlug: (slug: string) => void;
  /** Whether the header's city-selector modal is open — shared so any component (e.g. a category card clicked with no city in the URL) can trigger it. */
  citySelectorOpen: boolean;
  openCitySelector: (onSelect?: (citySlug: string) => void) => void;
  closeCitySelector: () => void;
  /** Called by CitySelectorModal after a city is chosen — resolves any pending onSelect callback from openCitySelector. */
  resolveCitySelection: (citySlug: string) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [lastCitySlug, setLastCitySlugState] = useState<string | null>(null);
  const [citySelectorOpen, setCitySelectorOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<((citySlug: string) => void) | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // One-time hydration from localStorage on mount — write the state
      // setter directly (not the persisting wrapper below) since the value
      // just came from localStorage and doesn't need writing back.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setLastCitySlugState(saved);
    } catch {
      // localStorage unavailable — feature degrades to URL-only city scoping
    }
  }, []);

  const setLastCitySlug = useCallback((slug: string) => {
    setLastCitySlugState(slug);
    try {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
      // ignore
    }
  }, []);

  const openCitySelector = useCallback((onSelect?: (citySlug: string) => void) => {
    setPendingCallback(() => onSelect ?? null);
    setCitySelectorOpen(true);
  }, []);

  const closeCitySelector = useCallback(() => {
    setCitySelectorOpen(false);
    setPendingCallback(null);
  }, []);

  const resolveCitySelection = useCallback(
    (citySlug: string) => {
      setLastCitySlug(citySlug);
      setCitySelectorOpen(false);
      if (pendingCallback) {
        pendingCallback(citySlug);
      } else {
        // Default behavior with no explicit destination: scope the current
        // browsing session to /[city] (PHASE_2_PAGE_STRUCTURE.md §2).
        router.push(`/${citySlug}`);
      }
      setPendingCallback(null);
    },
    [pendingCallback, setLastCitySlug, router]
  );

  const value = useMemo(
    () => ({
      lastCitySlug,
      setLastCitySlug,
      citySelectorOpen,
      openCitySelector,
      closeCitySelector,
      resolveCitySelection,
    }),
    [lastCitySlug, setLastCitySlug, citySelectorOpen, openCitySelector, closeCitySelector, resolveCitySelection]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within a LocationProvider");
  return ctx;
}
