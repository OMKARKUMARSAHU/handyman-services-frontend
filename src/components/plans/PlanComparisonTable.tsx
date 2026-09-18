import type { Plan } from "@/types";
import { PlanCard } from "./PlanCard";
import { cn } from "@/lib/utils";

/**
 * Renders any number of plans (1, 2, 3, 4+) without assuming a fixed
 * column count — see PHASE_2_UI_UX_DESIGN.md §4. Stacks on mobile, grids on
 * larger screens.
 */
export function PlanComparisonTable({ plans }: { plans: Plan[] }) {
  const gridCols =
    plans.length >= 4
      ? "lg:grid-cols-4"
      : plans.length === 3
      ? "lg:grid-cols-3"
      : plans.length === 2
      ? "lg:grid-cols-2"
      : "lg:grid-cols-1";

  return (
    <div className={cn("grid gap-6 sm:grid-cols-1 md:grid-cols-2", gridCols)}>
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
