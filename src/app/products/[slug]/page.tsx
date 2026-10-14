import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { ProductBuyBox } from "@/components/shop/ProductBuyBox";
import { ProductVideos } from "@/components/shop/ProductVideos";
import { ShopCartLink } from "@/components/shop/ShopCartLink";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { displayName, displayText, jsonLdString } from "@/components/shop/shopFormat";
import { demoImageFor } from "@/components/shop/shopDemoImage";
import { getShopProductLive } from "@/lib/shop/api";
import { SITE_URL } from "@/lib/seo/site";

// Same approach as /blog/[slug]: don't enumerate slugs at build time (a cold
// backend must never fail `next build`); pages render on first request and are
// then cached for 30s by the readers in `@/lib/shop/api`.
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

const abs = (url: string) => (url.startsWith("http") ? url : `${SITE_URL}${url}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getShopProductLive(slug);
  if (!data) return {};
  const p = data.product;
  const title = p.seoTitle || displayName(p.name);
  const description = p.seoDescription || displayText(p.shortDescription) || undefined;
  const image = p.images[0]?.url ?? p.primaryImage?.url;
  const canonical = `/products/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      images: image ? [{ url: abs(image) }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [abs(image)] : undefined },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getShopProductLive(slug);
  // Drafts, inactive products and products in hidden categories are 404s at the API, so they 404 here too.
  if (!data) notFound();
  const { product: p, related } = data;
  const canonicalUrl = `${SITE_URL}/products/${p.slug}`;
  const name = displayName(p.name);
  const shortText = displayText(p.shortDescription);
  const longText = displayText(p.description);

  // Structured data only from real, stored values (no invented ratings/reviews/brand/warranty). Demo listings
  // carry placeholder prices, so they are NOT marked up as real offers.
  const productJsonLd = p.isDemo
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        sku: p.sku,
        description: p.shortDescription || p.description || undefined,
        image: p.images.length ? p.images.map((i) => abs(i.url)) : undefined,
        category: p.category.name,
        url: canonicalUrl,
        offers: {
          "@type": "Offer",
          url: canonicalUrl,
          priceCurrency: "INR",
          price: p.price.toFixed(2),
          availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Products", item: `${SITE_URL}/products` },
      { "@type": "ListItem", position: 3, name: p.category.name, item: `${SITE_URL}/products?category=${p.category.slug}` },
      { "@type": "ListItem", position: 4, name },
    ],
  };

  return (
    <>
      {productJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />

      <article className="py-8 sm:py-12">
        <Container>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
              <Link href="/" className="hover:text-brand-700">Home</Link>
              <span className="text-neutral-300">/</span>
              <Link href="/products" className="hover:text-brand-700">Products</Link>
              <span className="text-neutral-300">/</span>
              <Link href={`/products?category=${p.category.slug}`} className="hover:text-brand-700">{p.category.name}</Link>
              <span className="text-neutral-300">/</span>
              <span aria-current="page" className="text-neutral-700">{name}</span>
            </nav>
            <ShopCartLink />
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <ProductGallery images={p.images} productName={name} fallbackUrl={p.isDemo ? demoImageFor(p.category.slug, p.name) : null} />

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl">{name}</h1>
              {shortText && <p className="mt-2 text-neutral-600">{shortText}</p>}

              <ProductBuyBox product={p} />

              {(p.deliveryInfo || p.returnInfo) && (
                <div className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  {p.deliveryInfo && (
                    <div>
                      <h2 className="font-semibold text-neutral-900">Delivery</h2>
                      <p className="mt-1 whitespace-pre-line text-neutral-600">{p.deliveryInfo}</p>
                    </div>
                  )}
                  {p.returnInfo && (
                    <div>
                      <h2 className="font-semibold text-neutral-900">Returns</h2>
                      <p className="mt-1 whitespace-pre-line text-neutral-600">{p.returnInfo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {longText && (
            <section aria-labelledby="desc-heading" className="mt-12">
              <h2 id="desc-heading" className="text-xl font-bold text-neutral-900">About this product</h2>
              {/* Rendered as plain text (never as HTML), so admin-entered content can't inject markup. */}
              <p className="mt-3 max-w-3xl whitespace-pre-line text-neutral-700">{longText}</p>
            </section>
          )}

          {p.specifications.length > 0 && (
            <section aria-labelledby="spec-heading" className="mt-10">
              <h2 id="spec-heading" className="text-xl font-bold text-neutral-900">Specifications</h2>
              <dl className="mt-4 max-w-3xl divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
                {p.specifications.map((s) => (
                  <div key={`${s.label}-${s.value}`} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
                    <dt className="font-medium text-neutral-600">{s.label}</dt>
                    <dd className="col-span-2 text-neutral-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.compatibleModels.length > 0 && (
            <section aria-labelledby="compat-heading" className="mt-10">
              <h2 id="compat-heading" className="text-xl font-bold text-neutral-900">Compatible models</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {p.compatibleModels.map((m) => (
                  <li key={m} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700">{m}</li>
                ))}
              </ul>
            </section>
          )}

          <ProductVideos videos={p.videos} productName={name} />

          {related.length > 0 && (
            <section aria-labelledby="related-heading" className="mt-14">
              <h2 id="related-heading" className="text-xl font-bold text-neutral-900">Related products</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
                {related.map((r) => (
                  <li key={r.id}><ShopProductCard product={r} /></li>
                ))}
              </ul>
            </section>
          )}
        </Container>
      </article>
    </>
  );
}
