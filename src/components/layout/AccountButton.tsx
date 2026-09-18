"use client";

import { useState } from "react";
import { HeaderActionButton, HeaderModal } from "./HeaderActionModal";
import { getTelLink, getWhatsAppLink } from "@/lib/data";

/**
 * Frontend-only account placeholder (Phase 4 frontend-polish scope).
 * No authentication exists yet — this is intentionally an honest
 * "coming soon" state rather than a fake sign-in form.
 */
export function AccountButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HeaderActionButton
        icon="user"
        label="Account"
        className={className}
        showLabel={showLabel}
        onClick={() => setOpen(true)}
      />
      <HeaderModal open={open} onClose={() => setOpen(false)} title="Account">
        <p className="text-sm text-neutral-600">Sign-in is coming soon.</p>
        <p className="mt-3 text-sm text-neutral-600">
          In the meantime, you can reach us directly:
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <a
            href={getTelLink()}
            className="rounded-lg border border-neutral-300 px-3.5 py-2.5 text-center text-sm font-semibold text-neutral-800 hover:border-brand-500 hover:text-brand-700"
          >
            Call us
          </a>
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-green-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white hover:bg-green-700"
          >
            Chat on WhatsApp
          </a>
        </div>
      </HeaderModal>
    </>
  );
}
