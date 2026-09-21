import serviceTypesData from "@/data/serviceTypes.json";
import type { ServiceType } from "@/types";

/**
 * Data-driven service-type lookup (Installation/Service/Repair/AMC today).
 * Deliberately not a hardcoded TypeScript union — see
 * PHASE_2_DATA_ARCHITECTURE.md §1.5 — so Admin can add a 5th type later
 * without a frontend code change.
 */
export async function getServiceTypes(): Promise<ServiceType[]> {
  return [...(serviceTypesData as ServiceType[])]
    .filter((t) => t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getServiceTypesSync(): ServiceType[] {
  return [...(serviceTypesData as ServiceType[])]
    .filter((t) => t.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getServiceTypeByIdSync(id: string): ServiceType | undefined {
  return (serviceTypesData as ServiceType[]).find((t) => t.id === id);
}
