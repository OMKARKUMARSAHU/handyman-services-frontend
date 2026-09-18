import Link from "next/link";
import type { Category } from "@/types";
import { Icon } from "@/lib/icons";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/services/${category.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-md"
    >
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
    </Link>
  );
}
