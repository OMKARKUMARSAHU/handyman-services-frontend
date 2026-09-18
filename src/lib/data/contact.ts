import contactData from "@/data/contact.json";
import type { ContactInfo } from "@/types";

export function getContactInfo(): ContactInfo {
  return contactData as ContactInfo;
}

/** Returns a wa.me link built from the stored WhatsApp number. */
export function getWhatsAppLink(presetMessage?: string): string {
  const digits = getContactInfo().whatsapp.replace(/[^\d]/g, "");
  const text = presetMessage ? `?text=${encodeURIComponent(presetMessage)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function getTelLink(): string {
  return `tel:${getContactInfo().phone.replace(/[^\d+]/g, "")}`;
}
