import Link from "next/link";
import type { Category, Appliance, Plan } from "@/types";
import { Icon } from "@/lib/icons";
import { Button } from "@/components/ui/Button";

export function ServiceDetailSection({
  category,
  appliances,
  relatedPlans,
}: {
  category: Category;
  appliances: Appliance[];
  relatedPlans: Plan[];
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name={category.icon} className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">{category.name}</h2>
            <p className="text-sm text-neutral-600">{category.description}</p>
          </div>
        </div>

        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          What&rsquo;s covered
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2">
          {appliances.map((appliance) => {
            return (
              <li
                key={appliance.id}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                {appliance.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- business photo, optimized separately per PHASE_4_FRONTEND_POLISH_REPORT.md
                  <img
                    src={appliance.image}
                    alt=""
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Icon name={appliance.icon} className="h-5 w-5" />
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{appliance.name}</p>
                  {appliance.description && (
                    <p className="mt-0.5 text-sm text-neutral-600">{appliance.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Covered by these plans
        </h3>
        <ul className="space-y-3">
          {relatedPlans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
              <Link href={`/plans#${plan.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                View plan
              </Link>
            </li>
          ))}
        </ul>
        <Button href="/contact" className="mt-5 w-full" size="md">
          Request a Service
        </Button>
      </aside>
    </div>
  );
}
