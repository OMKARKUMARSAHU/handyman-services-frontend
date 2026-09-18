import type { Metadata } from "next";
import { getCategories } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { CategoryGrid } from "@/components/home/CategoryGrid";

export const metadata: Metadata = {
  title: "Services & Appliance Categories",
  description:
    "Browse Handyman Services' appliance categories — cooling, kitchen appliances, water & heating, laundry and entertainment — to see what's covered under each plan.",
};

export default function ServicesPage() {
  const categories = getCategories();

  return (
    <>
      <PageHeader
        heading="Services & Appliance Categories"
        subheading="Browse by category to see exactly what's covered, then find the plan that fits."
      />
      <section className="py-12 sm:py-16">
        <CategoryGrid categories={categories} />
      </section>
    </>
  );
}
