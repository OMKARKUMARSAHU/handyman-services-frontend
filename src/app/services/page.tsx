import type { Metadata } from "next";
import { getCategories } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoryGrid } from "@/components/home/CategoryGrid";

// Phase 3 final visual-audit pass (item 8/9): this page is the fallback
// destination for the homepage's primary CTA when no city is known yet —
// its copy ("...to see what's covered under each plan" / "find the plan
// that fits") was still plan-era, from before the marketplace redesign.
// CategoryGrid/CategoryCard already route city-aware once a category is
// picked; only the copy needed fixing here, not the page's behavior.
export const metadata: Metadata = {
  title: "Services & Appliance Categories",
  description:
    "Browse Handyman Services' appliance categories — consumer durables, kitchen appliances, and water & air purifiers — to find installation, service, repair and AMC options near you.",
};

export default function ServicesPage() {
  const categories = getCategories();

  return (
    <>
      <PageHeader
        heading="Services & Appliance Categories"
        subheading="Browse by category, then pick your city to see what's available near you."
      />
      <section className="py-12 sm:py-16">
        <CategoryGrid categories={categories} />
      </section>
    </>
  );
}
