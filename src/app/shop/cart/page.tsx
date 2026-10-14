import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { ShopCartView } from "@/components/shop/ShopCartView";

export const metadata: Metadata = { title: "Product cart", robots: { index: false, follow: false } };

export default function ShopCartPage() {
  return (
    <>
      <PageHeader heading="Your product cart" />
      <section className="py-8 sm:py-12">
        <Container>
          <ShopCartView />
        </Container>
      </section>
    </>
  );
}
