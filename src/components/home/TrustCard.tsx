import { Icon } from "@/lib/icons";
import type { HomepageSectionItem } from "@/types";

export function TrustCard({ item }: { item: HomepageSectionItem }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon name={String(item.icon ?? "shield-check")} className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-base font-bold text-neutral-900">{item.title}</h3>
        <p className="mt-1 text-sm text-neutral-600">{item.description}</p>
      </div>
    </div>
  );
}
