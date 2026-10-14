import { SHOP_ORDER_STATUS_LABEL, SHOP_PAYMENT_STATUS_LABEL, type ShopOrderStatus, type ShopPaymentStatus } from "@/lib/shop/types";

const ORDER_TONE: Record<ShopOrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-cyan-100 text-cyan-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-700",
  refunded: "bg-purple-100 text-purple-800",
};
const PAY_TONE: Record<ShopPaymentStatus, string> = {
  unpaid: "bg-neutral-100 text-neutral-700",
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-800",
};

export function OrderStatusBadge({ status }: { status: ShopOrderStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_TONE[status]}`}>{SHOP_ORDER_STATUS_LABEL[status]}</span>;
}
export function PaymentStatusBadge({ status }: { status: ShopPaymentStatus }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAY_TONE[status]}`}>{SHOP_PAYMENT_STATUS_LABEL[status]}</span>;
}
