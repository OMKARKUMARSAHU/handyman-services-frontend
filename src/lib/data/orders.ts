import type { Address, Order, OrderItem, Service } from "@/types";
import { getServiceByIdSync } from "./services";

const ORDERS_STORAGE_KEY = "handyman:orders";

export interface CreateOrderPayload {
  items: { serviceId: string; quantity: number }[];
  address: Address;
  scheduledDate: string;
  /** [TBD — slot rules unconfirmed], see PHASE_2_OPEN_QUESTIONS.md #20. */
  scheduledSlot?: string;
  /** [TBD — depends on guest-checkout decision], reconciled with Order.customerId — PHASE_2_DATA_ARCHITECTURE.md §3, PHASE_2_OPEN_QUESTIONS.md #17. */
  customerId?: string;
}

export interface CreateOrderResult {
  success: boolean;
  order?: Order;
  message: string;
}

function readStoredOrders(): Record<string, Order> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Order>) : {};
  } catch {
    return {};
  }
}

function writeStoredOrders(orders: Record<string, Order>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // localStorage unavailable — order confirmation page degrades to "order placed" without recall
  }
}

/**
 * Mock order creation — mirrors the existing `submitLead` pattern
 * (src/lib/data/leads.ts): validates shape, simulates latency, and does
 * **not** talk to a real backend. Because there is no server in Phase 3,
 * the created Order is persisted to this browser's localStorage only, so
 * the order-confirmation page can read it back after redirect. This is a
 * Phase-3-only mock mechanism, not a real order store — a future backend
 * implementation replaces this function body only (PHASE_2_API_CONTRACT.md §8).
 *
 * [TBD] How this should behave if `items` resolves to services from more
 * than one city is unresolved — see PHASE_2_DATA_ARCHITECTURE.md §3 and
 * PHASE_2_OPEN_QUESTIONS.md #24. No restriction is enforced here.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  if (payload.items.length === 0) {
    return { success: false, message: "Your cart is empty — add a service before checking out." };
  }
  if (!payload.address.line1 || !payload.address.city || !payload.address.pincode) {
    return { success: false, message: "Please provide a complete address before checking out." };
  }
  if (!payload.scheduledDate) {
    return { success: false, message: "Please choose a preferred date before checking out." };
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  for (const item of payload.items) {
    const service: Service | undefined = getServiceByIdSync(item.serviceId);
    if (!service) continue;
    const lineTotal = service.offerPrice * item.quantity;
    subtotal += lineTotal;
    orderItems.push({
      id: `oi-${item.serviceId}-${Date.now()}`,
      serviceId: item.serviceId,
      quantity: item.quantity,
      unitPrice: service.offerPrice,
      lineTotal,
    });
  }

  const discountTotal = orderItems.reduce((sum, oi) => {
    const service = getServiceByIdSync(oi.serviceId);
    return sum + (service ? (service.mrp - service.offerPrice) * oi.quantity : 0);
  }, 0);

  const order: Order = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    customerId: payload.customerId ?? null,
    items: orderItems,
    address: payload.address,
    scheduledDate: payload.scheduledDate,
    scheduledSlot: payload.scheduledSlot ?? null,
    subtotal,
    discountTotal,
    total: subtotal,
    status: "pending",
    providerId: null,
    paymentStatus: "not_applicable_mock",
    createdAt: new Date().toISOString(),
  };

  const stored = readStoredOrders();
  stored[order.id] = order;
  writeStoredOrders(stored);

  return {
    success: true,
    order,
    message:
      "Your request has been received. This is a Phase 3 mock confirmation — no payment was taken and no technician has been dispatched. Our team will confirm your visit by phone/WhatsApp.",
  };
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const stored = readStoredOrders();
  return stored[orderId] ?? null;
}
