import plansData from "@/data/plans.json";
import type { Plan } from "@/types";

/**
 * Data Access Layer — Plans.
 *
 * Today this reads a local JSON mock file. Later it can call WordPress
 * REST/WPGraphQL + WooCommerce, or a custom API, without any change to the
 * function signature or return shape — see PHASE_2_SYSTEM_DESIGN.md §3.
 */
export function getPlans(): Plan[] {
  return [...(plansData as Plan[])]
    .filter((plan) => plan.available)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPlanById(id: string): Plan | undefined {
  return (plansData as Plan[]).find((plan) => plan.id === id);
}
