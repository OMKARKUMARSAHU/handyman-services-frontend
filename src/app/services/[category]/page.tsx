import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCategories,
  getCategoryById,
  getAppliancesByCategory,
  getPlans,
} from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { ServiceDetailSection } from "@/components/services/ServiceDetailSection";

export function generateStaticParams() {
  return getCategories().map((category) => ({ category: category.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) return {};

  return {
    title: `${category.name} Repair & Maintenance`,
    description: category.description,
  };
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryId } = await params;
  const category = getCategoryById(categoryId);
  if (!category) notFound();

  const appliances = getAppliancesByCategory(category.id);
  const relatedPlans = getPlans().filter(
    (plan) => plan.applianceIds === "all" || plan.applianceIds.includes(category.id)
  );

  return (
    <>
      <PageHeader heading={category.name} subheading={category.description} />
      <section className="py-12 sm:py-16">
        <Container>
          <ServiceDetailSection
            category={category}
            appliances={appliances}
            relatedPlans={relatedPlans}
          />
        </Container>
      </section>
    </>
  );
}
