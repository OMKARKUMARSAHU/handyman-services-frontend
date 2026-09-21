"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/types";
import { Icon } from "@/lib/icons";
import { useLocation } from "@/lib/state/LocationProvider";

/**
 * Hero-area "service discovery launcher" (Phase 3 "major homepage visual
 * rework" pass, item 3) — replaces the previous heading+buttons+circular-
 * shortcuts+green-icon-mosaic hero composition. A large, bordered, white
 * panel of category/product tiles, closer in structure to the reference
 * site's hero discovery panel than the old marketing-CTA hero — but every
 * tile routes into this app's own City → Category → Product hierarchy
 * (PHASE_2_SYSTEM_ARCHITECTURE.md §4), not a copy of the reference's markup
 * or content.
 *
 * The 9 tiles are a fixed, curated subset (not "all products" — that's what
 * `/services` and the category rails below are for): the 5 Consumer
 * Durables products, the Kitchen Appliances category as one tile, the two
 * Water & Air Purifier products, and a final "All Services" tile. Every id
 * referenced here already exists in `products.json`/`categories.json` —
 * nothing was invented to fill the grid.
 *
 * City-aware with the same fallback used elsewhere (CategoryCard,
 * ServiceCard, the old CategoryShortcuts this replaces): a known city
 * (prop, or LocationProvider's last-selected convenience value) links
 * straight to the resolved route; with no city yet, a click opens the
 * shared city selector instead of navigating to a route that can't
 * resolve.
 */
export function HeroDiscoveryPanel({
  products,
  categories,
  citySlug,
}: {
  products: Product[];
  categories: Category[];
  citySlug?: string;
}) {
  const router = useRouter();
  const { lastCitySlug, openCitySelector } = useLocation();
  const effectiveCitySlug = citySlug ?? lastCitySlug ?? undefined;

  const kitchenCategory = categories.find((c) => c.id === "kitchen-appliances");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  type Tile =
    | { kind: "product"; id: string; label: string; icon: string; href: (city: string) => string }
    | { kind: "category"; id: string; label: string; icon: string; href: (city: string) => string }
    | { kind: "all"; label: string; icon: string; href: string };

  const productTile = (id: string, label?: string): Tile | null => {
    const p = byId.get(id);
    if (!p) return null;
    return {
      kind: "product",
      id,
      label: label ?? p.name,
      icon: p.icon,
      href: (city: string) => `/${city}/${p.categoryId}/${p.slug}`,
    };
  };

  const tiles: Tile[] = [
    productTile("air-conditioner"),
    productTile("washing-machine"),
    productTile("refrigerator"),
    productTile("led-tv"),
    productTile("microwave-oven"),
    kitchenCategory
      ? {
          kind: "category",
          id: kitchenCategory.id,
          label: kitchenCategory.name,
          icon: kitchenCategory.icon,
          href: (city: string) => `/${city}/${kitchenCategory.id}`,
        }
      : null,
    productTile("ro", "Water Purifier"),
    productTile("air-purifier"),
    { kind: "all", label: "All Services", icon: "layout-grid", href: "/services" },
  ].filter((t): t is Tile => t !== null);

  function go(href: string) {
    if (effectiveCitySlug) {
      router.push(href);
    } else {
      openCitySelector((selectedCitySlug) => router.push(href.replace("{city}", selectedCitySlug)));
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        What do you need serviced?
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((tile) => {
          const tileClassName =
            "group flex flex-col items-center gap-2 rounded-xl border border-neutral-100 bg-white px-2 py-3 text-center transition-colors hover:border-brand-200 hover:bg-brand-50/40";
          const iconWrap = (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-50 text-brand-600 ring-1 ring-neutral-100 transition-colors group-hover:bg-brand-100">
              <Icon name={tile.icon} className="h-5 w-5" />
            </span>
          );
          const labelEl = (
            <span className="text-[11px] font-medium leading-tight text-neutral-700 sm:text-xs">
              {tile.label}
            </span>
          );

          if (tile.kind === "all") {
            return (
              <Link key="all-services" href={tile.href} className={tileClassName}>
                {iconWrap}
                {labelEl}
              </Link>
            );
          }

          if (effectiveCitySlug) {
            return (
              <Link
                key={tile.kind === "product" ? tile.id : `cat-${tile.id}`}
                href={tile.href(effectiveCitySlug)}
                className={tileClassName}
              >
                {iconWrap}
                {labelEl}
              </Link>
            );
          }

          return (
            <button
              key={tile.kind === "product" ? tile.id : `cat-${tile.id}`}
              type="button"
              onClick={() => go(tile.href("{city}"))}
              className={tileClassName}
            >
              {iconWrap}
              {labelEl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
