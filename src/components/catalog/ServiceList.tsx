import type { Service } from "@/types";
import { ServiceCard } from "./ServiceCard";

export function ServiceList({ services, citySlug }: { services: Service[]; citySlug: string }) {
  if (services.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
        Not yet available in this city.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} citySlug={citySlug} />
      ))}
    </div>
  );
}
