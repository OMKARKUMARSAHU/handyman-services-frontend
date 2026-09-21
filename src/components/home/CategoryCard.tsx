"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category } from "@/types";
import { Icon } from "@/lib/icons";
import { useLocation } from "@/lib/state/LocationProvider";

/**
 * When a citySlug is already known (city homepage, or the convenience
 * "last selected city" value), this is a plain link into
 * /[city]/[category] — the URL-based source of truth
 * (PHASE_2_SYSTEM_ARCHITECTURE.md §4). On the city-agnostic homepage with
 * no city known yet, clicking opens the shared city selector instead of
 * navigating to a route that doesn't resolve — the "scope, not gate"
 * default from PHASE_2_SYSTEM_ARCHITECTURE.md §4 / PHASE_2_PAGE_STRUCTURE.md §2.
 */
export function CategoryCard({ category, citySlug }: { category: Category; citySlug?: string }) {
  const router = useRouter();
  const { lastCitySlug, openCitySelector } = useLocation();
  const effectiveCitySlug = citySlug ?? lastCitySlug ?? undefined;

  const content = (
    <>
      {category.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- business photo, optimized separately per PHASE_4_FRONTEND_POLISH_REPORT.md
        <img
          src={category.image}
          alt={`${category.name} service`}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-500 transition-colors group-hover:from-brand-100 group-hover:to-brand-200">
          <Icon name={category.icon} className="h-10 w-10" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-base font-bold text-neutral-900">{category.name}</h2>
        <p className="mt-1.5 text-sm text-neutral-600">{category.description}</p>
        <span className="mt-4 inline-flex items-center text-sm font-semibold text-brand-700">
          Explore
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
          >
            <path d="M10.293 3.293a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L13.586 10H4a1 1 0 1 1 0-2h9.586l-3.293-3.293a1 1 0 0 1 0-1.414Z" />
          </svg>
        </span>
      </div>
    </>
  );

  const className =
    "group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-md";

  if (effectiveCitySlug) {
    return (
      <Link href={`/${effectiveCitySlug}/${category.id}`} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openCitySelector((selectedCitySlug) => {
        router.push(`/${selectedCitySlug}/${category.id}`);
      })}
      className={className}
    >
      {content}
    </button>
  );
}
