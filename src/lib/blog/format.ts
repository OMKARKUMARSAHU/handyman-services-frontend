/**
 * Blog Management System (Task 4) — small, pure display-formatting
 * helpers shared by the public blog listing and article pages, so a
 * published date or reading-time estimate reads identically wherever it
 * appears (card, featured post, article header, JSON-LD-adjacent text).
 */

export function formatBlogDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(date);
}

export function formatReadingTime(minutes: number | null): string | null {
  if (!minutes || minutes < 1) return null;
  return `${minutes} min read`;
}
