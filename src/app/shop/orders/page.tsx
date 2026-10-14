import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShopOrdersListView } from "@/components/shop/ShopOrdersListView";

export const metadata: Metadata = { title: "Product orders", robots: { index: false, follow: false } };

export default function ShopOrdersPage() {
  return (
    <>
      <PageHeader heading="Your product orders" />
      <section className="py-8 sm:py-12">
        <Container>
          <ShopOrdersListView />
        </Container>
      </section>
    </>
  );
}
