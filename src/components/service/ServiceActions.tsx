"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Service } from "@/types";
import { useCart } from "@/lib/state/CartProvider";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";

export function ServiceActions({ service, citySlug }: { service: Service; citySlug: string }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [shareState, setShareState] = useState<"idle" | "copied" | "unsupported">("idle");

  function handleAddToCart() {
    addToCart(service.id, citySlug);
  }

  function handleBuyNow() {
    // Adds this service without clearing any other items already in the
    // cart (PHASE_2_UI_UX_DESIGN.md §9 / Phase 4 test spec §10), then goes
    // straight to checkout.
    addToCart(service.id, citySlug);
    router.push("/checkout");
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: service.name, text: service.shortDescription, url };
    const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share(shareData);
        return;
      } catch {
        // user cancelled the native share sheet — not an error, no fallback needed
        return;
      }
    }
    // Fallback when the Web Share API is unavailable (most desktop browsers):
    // copy the link instead of throwing or doing nothing silently.
    try {
      await nav?.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("unsupported");
      setTimeout(() => setShareState("idle"), 2000);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" size="lg" onClick={handleAddToCart} className="flex-1">
          Add to Cart
        </Button>
        <Button size="lg" onClick={handleBuyNow} className="flex-1">
          Buy Now
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={handleShare}
          aria-label="Share this service"
          className="sm:flex-none"
        >
          <Icon name="message-circle" className="h-5 w-5" />
          Share
        </Button>
      </div>
      {shareState === "copied" && (
        <p className="mt-2 text-xs font-medium text-green-700">Link copied to clipboard.</p>
      )}
      {shareState === "unsupported" && (
        <p className="mt-2 text-xs font-medium text-neutral-500">
          Sharing isn&rsquo;t supported in this browser — copy the page link from your address bar.
        </p>
      )}
    </div>
  );
}
