import type { Metadata } from "next";
import { getPlans } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { PlanComparisonTable } from "@/components/plans/PlanComparisonTable";

export const metadata: Metadata = {
  title: "Plans & Pricing",
  description:
    "Compare Handyman Services' Silver, Gold and Platinum annual appliance plans — visits, coverage and features side by side.",
};

export default function PlansPage() {
  const plans = getPlans();

  return (
    <>
      <PageHeader
        heading="Plans & Pricing"
        subheading="One annual plan, every visit scheduled and reported — pick the coverage that fits your home."
      />
      <section className="py-12 sm:py-16">
        <Container>
          <PlanComparisonTable plans={plans} />
        </Container>
      </section>
    </>
  );
}
