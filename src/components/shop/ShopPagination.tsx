import Link from "next/link";

/** Server-rendered pagination (plain links => crawlable, works without JS). */
export function ShopPagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/products?${qs}` : "/products";
  };
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  const linkClass = "rounded-lg border px-3 py-2 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={`${linkClass} border-neutral-300 text-neutral-700 hover:border-brand-500`}>
          Previous
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && pages[i - 1]! < p - 1 ? <span className="text-neutral-400">…</span> : null}
          {p === page ? (
            <span aria-current="page" className={`${linkClass} border-brand-600 bg-brand-600 text-white`}>
              {p}
            </span>
          ) : (
            <Link href={href(p)} className={`${linkClass} border-neutral-300 text-neutral-700 hover:border-brand-500`}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={`${linkClass} border-neutral-300 text-neutral-700 hover:border-brand-500`}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
