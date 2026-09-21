import { getWhatsAppLink } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Click-to-chat WhatsApp action. An original chat-bubble glyph is used
 * rather than a third-party brand mark, per the "no proprietary assets"
 * rule that applies to every reference site, not only Urban Company.
 *
 * The `floating` variant is now the site's *only* WhatsApp entry point at
 * every breakpoint ("FINAL HOMEPAGE / UX CORRECTION" item 13 — see
 * layout.tsx's doc comment for why the old full-width mobile bar is gone).
 * It was already exactly the small-circular-fixed-bottom-right treatment
 * the client asked for; the only change here is making it render on mobile
 * too (it used to be `hidden md:flex` from the call site, with the old
 * `StickyMobileCTA` bar covering mobile instead) and adding safe-area
 * inset support so it never sits under a phone's home-indicator/gesture
 * area. It never pushes page content (its own `fixed` positioning takes it
 * out of the document flow entirely) and never spans full width at any
 * screen size.
 */
export function WhatsAppButton({
  className,
  label = "Chat on WhatsApp",
  presetMessage = "Hi! I'd like help with an appliance service.",
  variant = "default",
}: {
  className?: string;
  label?: string;
  presetMessage?: string;
  variant?: "default" | "floating";
}) {
  const href = getWhatsAppLink(presetMessage);

  if (variant === "floating") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(
          "fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105",
          className
        )}
        style={{
          right: "max(1rem, env(safe-area-inset-right))",
          bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 1rem))",
        }}
      >
        <ChatGlyph />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800",
        className
      )}
    >
      <ChatGlyph className="h-4 w-4" />
      {label}
    </a>
  );
}

function ChatGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className ?? "h-6 w-6"}
    >
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.3 14.8l-.4-.2-2.9.8.8-2.8-.2-.4A8 8 0 0 1 12 4Zm-3.1 3.8c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3 0 1.4 1 2.7 1.1 2.9.2.2 2 3.1 4.9 4.2 2.4.9 2.9.7 3.4.7.5-.1 1.7-.7 2-1.4.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3l-2.1-1c-.3-.1-.5-.1-.7.1l-.6.8c-.2.2-.4.2-.6.1-.3-.1-1.2-.5-2.3-1.5-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.2-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5h-.5Z" />
    </svg>
  );
}
