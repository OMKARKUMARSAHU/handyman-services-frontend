"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Cart, CartItem } from "@/types";
import { getServiceByIdSync } from "@/lib/data/services";

const STORAGE_KEY = "handyman:cart";

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function emptyCart(): Cart {
  return { id: "local-cart", customerId: null, sessionId: newSessionId(), items: [] };
}

interface CartContextValue {
  cart: Cart;
  itemCount: number;
  subtotal: number;
  /** cityId is the city the service is being added under (from the current URL) — see CartItem.cityId doc comment for the unresolved multi-city question this is structural for, not a resolution of it. */
  addToCart: (serviceId: string, cityId: string, quantity?: number) => void;
  updateCartItemQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  /** Distinct city ids currently represented in the cart — purely informational, used to surface (not resolve) the multi-city TBD in the UI. */
  cityIdsInCart: string[];
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [hydrated, setHydrated] = useState(false);

  // One-time hydration from localStorage on mount (no external subscription to sync against).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Cart;
        if (parsed && Array.isArray(parsed.items)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCart(parsed);
        }
      }
    } catch {
      // localStorage unavailable — cart just starts empty for this session
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore — cart still works in-memory for this page view
    }
  }, [cart, hydrated]);

  const addToCart = useCallback((serviceId: string, cityId: string, quantity = 1) => {
    const service = getServiceByIdSync(serviceId);
    if (!service) return;
    setCart((prev) => {
      const existing = prev.items.find(
        (item) => item.serviceId === serviceId && item.cityId === cityId
      );
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          ),
        };
      }
      const newItem: CartItem = {
        id: `ci-${serviceId}-${cityId}-${Date.now()}`,
        serviceId,
        quantity,
        unitPriceAtAdd: service.offerPrice,
        cityId,
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const updateCartItemQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return { ...prev, items: prev.items.filter((item) => item.id !== cartItemId) };
      }
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === cartItemId ? { ...item, quantity } : item
        ),
      };
    });
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== cartItemId) }));
  }, []);

  const clearCart = useCallback(() => {
    setCart((prev) => ({ ...prev, items: [] }));
  }, []);

  const itemCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
    [cart.items]
  );
  const subtotal = useMemo(
    () => cart.items.reduce((sum, item) => sum + item.unitPriceAtAdd * item.quantity, 0),
    [cart.items]
  );
  const cityIdsInCart = useMemo(
    () => Array.from(new Set(cart.items.map((item) => item.cityId))),
    [cart.items]
  );

  const value = useMemo(
    () => ({
      cart,
      itemCount,
      subtotal,
      addToCart,
      updateCartItemQuantity,
      removeFromCart,
      clearCart,
      cityIdsInCart,
    }),
    [cart, itemCount, subtotal, addToCart, updateCartItemQuantity, removeFromCart, clearCart, cityIdsInCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
