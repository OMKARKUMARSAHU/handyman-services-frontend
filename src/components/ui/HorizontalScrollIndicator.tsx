import type { HorizontalScrollState } from "@/lib/hooks/useHorizontalScrollIndicator";
import { cn } from "@/lib/utils";

/**
 * HORIZONTAL RAIL SCROLL INDICATOR — GLOBAL UX FIX phase.
 *
 * A thin track + thumb, placed directly below a horizontally-scrolling
 * rail, showing how much of the rail's content is currently visible and
 * where the visible window sits within the full scrollable width. Purely
 * presentational — all of the actual scroll math lives in
 * `useHorizontalScrollIndicator`; this component only draws whatever state
 * that hook hands it.
 *
 * Renders nothing when `state.hasOverflow` is false — a rail whose content
 * already fits (a category with only 2 cards, a rail at a wide desktop
 * width, or any rail that becomes a static grid at `sm:`+) shows no
 * indicator at all, exactly like a native scrollbar that only exists when
 * there's something to scroll.
 *
 * Deliberately non-interactive (not draggable, not a `role="slider"`): the
 * brief explicitly allows a synchronized-visual-only indicator when a
 * draggable thumb would add "unnecessary complexity or accessibility
 * problems," and here that trade-off clearly favors simplicity — this same
 * component is reused across six rails with very different card sizes, and
 * a single shared drag-to-scroll implementation robust enough for all of
 * them (plus the keyboard/slider semantics a real `role="slider"` thumb
 * would require) is a much larger surface for a purely-discoverability
 * feature. The rail itself remains fully touch/trackpad/mouse-scrollable —
 * nothing here reads or writes `scrollLeft` except to display it. Because
 * it conveys no information a sighted mouse/touch user isn't already
 * getting from the rail's own scroll position, and a screen-reader user
 * gets the same "more items" signal from the rail's existing
 * `role="region"`/`aria-label` and normal DOM order, it is marked
 * `aria-hidden` so assistive tech doesn't announce a meaningless decorative
 * bar, and is not made keyboard-focusable.
 */
export function HorizontalScrollIndicator({
  state,
  className,
  /**
   * "neutral" (default) is for the app's normal white/neutral-50 sections.
   * "inverted" is for a rail on a dark background (e.g. the Video
   * Curations section's `bg-neutral-950` band) — same white/opacity-based
   * track+thumb convention already used by that section's own progress bar
   * in VideoCurationModal.tsx, rather than a barely-visible dark-on-dark
   * track.
   */
  tone = "neutral",
}: {
  state: HorizontalScrollState;
  className?: string;
  tone?: "neutral" | "inverted";
}) {
  if (!state.hasOverflow) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative mt-2 h-1 w-full overflow-hidden rounded-full",
        tone === "inverted" ? "bg-white/15" : "bg-neutral-200",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 rounded-full transition-[left,width] duration-100 ease-out",
          tone === "inverted" ? "bg-white/70" : "bg-neutral-400"
        )}
        style={{ left: `${state.thumbLeftPct}%`, width: `${state.thumbWidthPct}%` }}
      />
    </div>
  );
}
