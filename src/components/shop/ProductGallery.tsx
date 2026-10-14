"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ShopImage } from "@/lib/shop/types";

/** Image gallery: large image + thumbnails (up to ~6), keyboard-accessible, with previous/next. */
export function ProductGallery({ images, productName, fallbackUrl }: { images: ShopImage[]; productName: string; fallbackUrl?: string | null }) {
  const [active, setActive] = useState(0);
  if (images.length === 0 && fallbackUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- bundled demo illustration */}
        <img src={fallbackUrl} alt={productName} className="aspect-square w-full object-contain" />
      </div>
    );
  }
  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-neutral-100 text-neutral-300">
        <Icon name="package" className="h-16 w-16" />
        <span className="sr-only">No product images yet</span>
      </div>
    );
  }
  const current = images[Math.min(active, images.length - 1)]!;
  const go = (d: number) => setActive((i) => (i + d + images.length) % images.length);
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- Media Library URL served through the same-origin proxy */}
        <img src={current.url} alt={current.altText || `${productName} — image ${active + 1}`} className="aspect-square w-full object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
              <Icon name="chevron-left" className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
              <Icon name="chevron-right" className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product image thumbnails">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={cn("h-16 w-16 overflow-hidden rounded-lg border-2 bg-neutral-100 sm:h-20 sm:w-20", i === active ? "border-brand-600" : "border-transparent hover:border-neutral-300")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
                <img src={img.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
