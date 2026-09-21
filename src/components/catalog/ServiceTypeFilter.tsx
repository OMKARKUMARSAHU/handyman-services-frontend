"use client";

import type { ServiceType } from "@/types";
import { cn } from "@/lib/utils";

export function ServiceTypeFilter({
  serviceTypes,
  activeId,
  onChange,
}: {
  serviceTypes: ServiceType[];
  /** null = "All" */
  activeId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div role="tablist" aria-label="Filter by service type" className="flex flex-wrap gap-2">
      <button
        type="button"
        role="tab"
        aria-selected={activeId === null}
        onClick={() => onChange(null)}
        className={cn(
          "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
          activeId === null
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-neutral-300 text-neutral-700 hover:border-brand-400"
        )}
      >
        All
      </button>
      {serviceTypes.map((type) => (
        <button
          key={type.id}
          type="button"
          role="tab"
          aria-selected={activeId === type.id}
          onClick={() => onChange(type.id)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            activeId === type.id
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-neutral-300 text-neutral-700 hover:border-brand-400"
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
