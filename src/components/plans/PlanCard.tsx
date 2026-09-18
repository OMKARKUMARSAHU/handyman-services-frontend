import type { Plan } from "@/types";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function PlanCard({ plan }: { plan: Plan }) {
  const featured = Boolean(plan.badge);

  return (
    <div
      id={plan.id}
      className={cn(
        "relative flex h-full scroll-mt-24 flex-col rounded-2xl border bg-white p-6 shadow-sm sm:p-8",
        featured ? "border-brand-500 ring-1 ring-brand-500" : "border-neutral-200"
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge>{plan.badge}</Badge>
        </div>
      )}

      <h2 className="text-lg font-bold text-neutral-900">{plan.name}</h2>
      <p className="mt-1 text-sm text-neutral-600">{plan.description}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-neutral-900">
          {formatPrice(plan.price, plan.currency)}
        </span>
        <span className="text-sm text-neutral-500">/ {plan.billingPeriod}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
            >
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Button
        href={`/contact?plan=${plan.id}`}
        size="lg"
        variant={featured ? "primary" : "outline"}
        className="mt-8 w-full"
      >
        {plan.ctaText}
      </Button>
    </div>
  );
}
