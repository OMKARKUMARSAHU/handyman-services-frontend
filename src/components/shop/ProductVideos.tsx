"use client";

import { useState } from "react";
import type { ShopVideo } from "@/lib/shop/types";

/**
 * Product videos: YouTube (privacy-enhanced nocookie embed, loaded only after
 * the visitor clicks play, so no third-party request happens on page load) and
 * uploaded videos (native player, `preload="none"`).
 */
export function ProductVideos({ videos, productName }: { videos: ShopVideo[]; productName: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="product-videos-heading" className="mt-10">
      <h2 id="product-videos-heading" className="text-xl font-bold text-neutral-900">
        Product videos
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {videos.map((v) => (
          <li key={v.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="aspect-video bg-neutral-900">
              {v.kind === "youtube" && v.youtubeId ? (
                playing === v.id ? (
                  <iframe
                    src={`${v.embedUrl}?autoplay=1&rel=0`}
                    title={v.title || `${productName} video`}
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full"
                  />
                ) : (
                  <button type="button" onClick={() => setPlaying(v.id)} className="group relative flex h-full w-full items-center justify-center" aria-label={`Play video: ${v.title || productName}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- YouTube poster thumbnail */}
                    <img src={`https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg group-hover:scale-105" aria-hidden="true">
                      ▶
                    </span>
                  </button>
                )
              ) : v.url ? (
                <video src={v.url} controls preload="none" playsInline className="h-full w-full" />
              ) : null}
            </div>
            {v.title && <p className="px-4 py-3 text-sm font-medium text-neutral-800">{v.title}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
