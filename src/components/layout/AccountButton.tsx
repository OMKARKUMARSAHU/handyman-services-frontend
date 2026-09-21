import Link from "next/link";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Restructured per PHASE_2_COMPONENT_ARCHITECTURE.md §3: the previous
 * "coming soon" inline modal becomes a real navigation entry point to
 * /login, since login is now a full flow (not a one-off placeholder
 * message). /login itself still shows an honest "method not yet decided"
 * state — no method is invented here (Phase 1 §19, still TBD).
 *
 * Rendered as a Link (not HeaderActionButton's <button>) since a button
 * nested inside an anchor is invalid HTML — same icon-button visual
 * language, applied directly here.
 */
export function AccountButton({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <Link
      href="/login"
      aria-label={showLabel ? undefined : "Account"}
      title={showLabel ? undefined : "Account"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100",
        showLabel ? "gap-1.5 px-3 py-2 text-sm font-medium" : "h-9 w-9",
        className
      )}
    >
      <Icon name="user" className="h-5 w-5 shrink-0" />
      {showLabel && <span>Account</span>}
    </Link>
  );
}
