import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShopCheckoutView } from "@/components/shop/ShopCheckoutView";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function ShopCheckoutPage() {
  return (
    <>
      <PageHeader heading="Checkout" subheading="Delivery address, review and secure payment." />
      <section className="py-8 sm:py-12">
        <Container>
          <ShopCheckoutView />
        </Container>
      </section>
    </>
  );
}
