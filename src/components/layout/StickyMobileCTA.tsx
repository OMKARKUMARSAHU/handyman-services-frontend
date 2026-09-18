import { getWhatsAppLink, getTelLink } from "@/lib/data";

/** Persistent mobile action bar — WhatsApp + Request a Service (Phase 2 UI/UX §2). */
export function StickyMobileCTA() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden">
      <a
        href={getWhatsAppLink("Hi! I'd like to know more about your appliance plans.")}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold text-green-700"
      >
        WhatsApp Us
      </a>
      <a
        href="/contact"
        className="flex flex-1 items-center justify-center gap-2 border-l border-neutral-200 bg-brand-600 py-3 text-sm font-semibold text-white"
      >
        Request a Service
      </a>
      <a
        href={getTelLink()}
        aria-label="Call us"
        className="flex w-14 items-center justify-center border-l border-neutral-200 text-neutral-700"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
      </a>
    </div>
  );
}
