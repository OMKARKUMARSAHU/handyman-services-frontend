"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Browser-local shop cart: only { productId, quantity } is stored. Prices,
 * names, stock and totals are NEVER kept here — every view re-prices the cart
 * through `POST /shop/cart/price`, and the backend recomputes everything again
 * at order creation. A tampered localStorage therefore can't change what is
 * charged. Kept separate from the service-booking cart (`handyman:cart`).
 */
const STORAGE_KEY = "handyman:shop-cart";
const MAX_QTY = 20;

export interface ShopCartItem {
  productId: string;
  quantity: number;
}

interface ShopCartContextValue {
  items: ShopCartItem[];
  itemCount: number;
  hydrated: boolean;
  addItem: (productId: string, quantity?: number, max?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const ShopCartContext = createContext<ShopCartContextValue | null>(null);

function sanitize(raw: unknown): ShopCartItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ShopCartItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const { productId, quantity } = r as Partial<ShopCartItem>;
    if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId) || seen.has(productId)) continue;
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1) continue;
    seen.add(productId);
    out.push({ productId, quantity: Math.min(q, MAX_QTY) });
  }
  return out;
}

export function ShopCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (raw) setItems(sanitize(JSON.parse(raw)));
    } catch {
      // localStorage unavailable or corrupt — start empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore (private mode / quota)
    }
  }, [items, hydrated]);

  // Keep several tabs in sync.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      try {
        setItems(e.newValue ? sanitize(JSON.parse(e.newValue)) : []);
      } catch {
        setItems([]);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((productId: string, quantity = 1, max = MAX_QTY) => {
    setItems((prev) => {
      const cap = Math.max(1, Math.min(max, MAX_QTY));
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(cap, i.quantity + quantity) } : i));
      return [...prev, { productId, quantity: Math.min(cap, Math.max(1, quantity)) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity < 1 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, MAX_QTY) } : i))
    );
  }, []);

  const removeItem = useCallback((productId: string) => setItems((prev) => prev.filter((i) => i.productId !== productId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<ShopCartContextValue>(
    () => ({ items, itemCount: items.reduce((n, i) => n + i.quantity, 0), hydrated, addItem, setQuantity, removeItem, clear }),
    [items, hydrated, addItem, setQuantity, removeItem, clear]
  );
  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart(): ShopCartContextValue {
  const ctx = useContext(ShopCartContext);
  if (!ctx) throw new Error("useShopCart must be used inside <ShopCartProvider>.");
  return ctx;
}
