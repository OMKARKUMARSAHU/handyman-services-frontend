"use client";

import { useState } from "react";
import type { ServiceImage } from "@/types";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { HorizontalRailNavigation } from "@/components/ui/HorizontalRailNavigation";
import { useHorizontalRailScroll } from "@/lib/hooks/useHorizontalRailScroll";

export function ServiceGallery({ images, serviceName }: { images: ServiceImage[]; serviceName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Hooks run unconditionally, before the `images.length === 0` early
  // return below.
  const { ref: thumbScrollRef, canScrollLeft, canScrollRight, onScrollLeft, onScrollRight } =
    useHorizontalRailScroll<HTMLDivElement>(images.length);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        <Icon name="wrench" className="h-12 w-12" />
      </div>
    );
  }

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = sorted[activeIndex] ?? sorted[0];

  function go(delta: number) {
    setActiveIndex((i) => (i + delta + sorted.length) % sorted.length);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- mock/placeholder gallery asset */}
        <img
          src={active.url}
          alt={active.alt || `${serviceName} — photo ${activeIndex + 1}`}
          className="aspect-[4/3] w-full object-cover"
        />
        {sorted.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow hover:bg-white"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-neutral-900/60 px-2 py-0.5 text-xs text-white">
              {activeIndex + 1} / {sorted.length}
            </span>
          </>
        )}
      </div>
      {sorted.length > 1 && (
        <div className="relative mt-3">
          <div
            ref={thumbScrollRef}
            role="region"
            aria-label={`${serviceName} — photo thumbnails, scrollable list`}
            className="flex gap-2 overflow-x-auto"
          >
            {sorted.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === activeIndex}
                className={cn(
                  "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2",
                  i === activeIndex ? "border-brand-600" : "border-transparent"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- mock/placeholder gallery asset */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <HorizontalRailNavigation
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
            onScrollLeft={onScrollLeft}
            onScrollRight={onScrollRight}
            label={`${serviceName} photo thumbnails`}
          />
        </div>
      )}
    </div>
  );
}
