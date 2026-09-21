"use client";

import { useMemo, useState } from "react";
import type { Service, ServiceType } from "@/types";
import { ServiceTypeFilter } from "./ServiceTypeFilter";
import { ServiceList } from "./ServiceList";

export function ProductServicesSection({
  services,
  serviceTypes,
  citySlug,
}: {
  services: Service[];
  serviceTypes: ServiceType[];
  citySlug: string;
}) {
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);

  const availableTypeIds = useMemo(
    () => new Set(services.map((s) => s.serviceTypeId)),
    [services]
  );
  const relevantTypes = serviceTypes.filter((t) => availableTypeIds.has(t.id));

  const filtered = activeTypeId ? services.filter((s) => s.serviceTypeId === activeTypeId) : services;

  return (
    <div>
      {relevantTypes.length > 1 && (
        <div className="mb-6">
          <ServiceTypeFilter serviceTypes={relevantTypes} activeId={activeTypeId} onChange={setActiveTypeId} />
        </div>
      )}
      <ServiceList services={filtered} citySlug={citySlug} />
    </div>
  );
}
