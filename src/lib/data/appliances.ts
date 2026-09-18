import appliancesData from "@/data/appliances.json";
import type { Appliance } from "@/types";

export function getAppliances(): Appliance[] {
  return [...(appliancesData as Appliance[])];
}

export function getAppliancesByCategory(categoryId: string): Appliance[] {
  return (appliancesData as Appliance[]).filter(
    (appliance) => appliance.categoryId === categoryId
  );
}

export function getApplianceById(id: string): Appliance | undefined {
  return (appliancesData as Appliance[]).find((appliance) => appliance.id === id);
}
