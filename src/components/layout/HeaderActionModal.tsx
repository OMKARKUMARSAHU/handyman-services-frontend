"use client";

import { useEffect } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for the header's frontend-only utility controls
 * (search, location, account, cart) — a compact icon button that opens a
 * simple centered modal. Kept intentionally simple (no anchored popovers)
 * so it can never be the source of a horizontal-overflow regression.
 */
export function HeaderActionButton({
  icon,
  label,
  className,
  showLabel = false,
  onClick,
}: {
  icon: string;
  label: string;
  className?: string;
  /** When true, renders as a labelled pill (used inside the mobile menu panel) instead of an icon-only square button. */
  showLabel?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100",
        showLabel ? "gap-1.5 px-3 py-2 text-sm font-medium" : "h-9 w-9",
        className
      )}
    >
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

export function HeaderModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 px-4 pt-24 sm:pt-28"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
