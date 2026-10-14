import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShopOrderDetailView } from "@/components/shop/ShopOrderDetailView";

export const metadata: Metadata = { title: "Product order", robots: { index: false, follow: false } };

export default async function ShopOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader heading="Order details" />
      <section className="py-8 sm:py-12">
        <Container>
          <ShopOrderDetailView orderId={id} />
        </Container>
      </section>
    </>
  );
}
