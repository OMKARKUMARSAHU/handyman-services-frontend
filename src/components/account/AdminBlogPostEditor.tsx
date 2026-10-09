"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { MediaPicker } from "@/components/account/MediaPicker";
import { BlogRichTextEditor } from "@/components/account/BlogRichTextEditor";
import type { Media } from "@/lib/admin/media-library-api";
import {
  AuthApiError,
  createBlogPost,
  deleteBlogPost,
  getBlogPostAdmin,
  listBlogCategoriesAdmin,
  listBlogTagsAdmin,
  updateBlogPost,
  type BlogCategory,
  type BlogPostStatus,
  type BlogPostWriteInput,
  type BlogTag,
} from "@/lib/admin/blog-api";

const outlineBtn =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50";
const brandBtn =
  "rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50";
const amberBtn =
  "rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn = "rounded-lg px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function estimateReadingStats(html: string): { wordCount: number; readingTimeMinutes: number } {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
  const words = text ? text.split(/\s+/) : [];
  const wordCount = words.length;
  return { wordCount, readingTimeMinutes: wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0 };
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function successMessageFor(status: BlogPostStatus): string {
  if (status === "draft") return "Draft saved.";
  if (status === "published") return "Post published.";
  if (status === "scheduled") return "Post scheduled.";
  return "Post archived.";
}

/**
 * Create/edit screen for one blog post (requirements 2–3). Everything is
 * client-side form state until an explicit Save/Publish/Schedule action —
 * "Preview" (requirement 3's "without accidentally publishing") renders
 * the in-memory draft with the same `.blog-article-content` styling the
 * public article page uses, with no network call at all.
 */
export function AdminBlogPostEditor({
  postId,
  initialCategoryId = null,
  onDone,
}: {
  postId: string | null;
  /** Category to preselect on a NEW post (the category the admin was working in). Ignored when editing an existing post, whose own saved category always wins. */
  initialCategoryId?: string | null;
  /** Leave the editor. `message` (a confirmation of a genuinely successful save) is shown on the All Posts screen. */
  onDone: (message?: string) => void;
}) {
  const [loading, setLoading] = useState(postId !== null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BlogPostStatus | null>(null);
  // `saving` state updates asynchronously, so two clicks inside one frame
  // could both pass a `if (saving)` check; the ref flips synchronously.
  const saveInFlight = useRef(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);

  const [id, setId] = useState<string | null>(postId);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [featuredImage, setFeaturedImage] = useState<{ mediaId: string; url: string | null; alt: string | null } | null>(null);
  const [featuredImageAlt, setFeaturedImageAlt] = useState("");
  const [ogImage, setOgImage] = useState<{ mediaId: string; url: string | null } | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(postId ? null : initialCategoryId);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<BlogPostStatus>("draft");
  const [scheduleDate, setScheduleDate] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [savedStats, setSavedStats] = useState<{ wordCount: number | null; readingTimeMinutes: number | null }>({
    wordCount: null,
    readingTimeMinutes: null,
  });
  const [publishedAtDisplay, setPublishedAtDisplay] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    Promise.all([listBlogCategoriesAdmin(), listBlogTagsAdmin()])
      .then(([cats, tagList]) => {
        setCategories(cats);
        setTags(tagList);
      })
      .catch(() => {
        // Non-fatal — category/tag pickers just show empty; the main post
        // load below still reports its own error if that fails too.
      });
  }, []);

  useEffect(() => {
    // A new post has nothing to load (`loading` already starts false for it).
    if (!postId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getBlogPostAdmin(postId)
      .then((post) => {
        setId(post.id);
        setTitle(post.title);
        setSlug(post.slug);
        setSlugTouched(true);
        setExcerpt(post.excerpt ?? "");
        setContent(post.content);
        setFeaturedImage(post.featuredImage);
        setFeaturedImageAlt(post.featuredImage?.alt ?? "");
        setOgImage(post.ogImage);
        setCategoryId(post.category?.id ?? null);
        setTagIds(post.tags.map((t) => t.id));
        setStatus(post.status);
        setScheduleDate(post.status === "scheduled" && post.publishedAt ? toDateTimeLocal(post.publishedAt) : "");
        setSeoTitle(post.seoTitle ?? "");
        setSeoDescription(post.seoDescription ?? "");
        setCanonicalUrl(post.canonicalUrl ?? "");
        setSavedStats({ wordCount: post.wordCount, readingTimeMinutes: post.readingTimeMinutes });
        setPublishedAtDisplay(post.publishedAt);
      })
      .catch((err) => setError(err instanceof AuthApiError ? err.message : "Could not load this post."))
      .finally(() => setLoading(false));
  }, [postId]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  const liveStats = useMemo(() => estimateReadingStats(content), [content]);

  function buildPayload(nextStatus: BlogPostStatus): BlogPostWriteInput | null {
    if (!title.trim()) {
      setError("Title is required.");
      return null;
    }
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) {
      setError("A URL slug is required.");
      return null;
    }
    const plainText = content.replace(/<[^>]*>/g, "").trim();
    if (!plainText) {
      setError("The article body can't be empty.");
      return null;
    }
    if (nextStatus === "scheduled" && !scheduleDate) {
      setError("Choose a publish date and time to schedule this post.");
      return null;
    }
    if (nextStatus === "scheduled" && new Date(scheduleDate).getTime() <= Date.now()) {
      setError("The scheduled date and time must be in the future.");
      return null;
    }
    if (featuredImage && !featuredImageAlt.trim()) {
      setError("Add alt text for the featured image — it's required for accessibility and SEO.");
      return null;
    }

    setError(null);
    return {
      slug: normalizedSlug,
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      content,
      featuredImageMediaId: featuredImage?.mediaId ?? null,
      featuredImageAlt: featuredImageAlt.trim() || null,
      ogImageMediaId: ogImage?.mediaId ?? null,
      categoryId,
      tagIds,
      status: nextStatus,
      publishedAt: nextStatus === "scheduled" ? new Date(scheduleDate).toISOString() : undefined,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      canonicalUrl: canonicalUrl.trim() || null,
    };
  }

  async function handleSave(nextStatus: BlogPostStatus) {
    if (saveInFlight.current) return; // duplicate-submission guard
    const payload = buildPayload(nextStatus);
    if (!payload) return;
    saveInFlight.current = true;
    setSaving(true);
    setPendingStatus(nextStatus);
    setError(null);
    setSuccessMessage(null);
    try {
      // Nothing below runs until the backend has confirmed the write: a
      // rejected request jumps to `catch`, leaving every field untouched so
      // the admin can fix the problem and retry without retyping anything.
      const saved = id ? await updateBlogPost(id, payload) : await createBlogPost(payload);
      setId(saved.id);
      setSlug(saved.slug);
      setStatus(saved.status);
      setCategoryId(saved.category?.id ?? null);
      setSavedStats({ wordCount: saved.wordCount, readingTimeMinutes: saved.readingTimeMinutes });
      setPublishedAtDisplay(saved.publishedAt);
      const message = successMessageFor(saved.status);
      if (saved.status === "draft") {
        // A draft save keeps the editor open for further work.
        setSuccessMessage(message);
      } else {
        // Published / scheduled / archived: the server has confirmed the
        // write, so go back to All Posts, which refetches and shows it.
        onDone(`"${saved.title}" — ${message.charAt(0).toLowerCase()}${message.slice(1)}`);
        return;
      }
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not save this post. Your changes are still here — check the fields and try again.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
      setPendingStatus(null);
    }
  }

  async function handleDeletePermanently() {
    if (!id) return;
    if (!window.confirm("Permanently delete this post? This cannot be undone — consider Archiving instead if you might want it back.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteBlogPost(id);
      onDone();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not delete this post.");
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onDone()}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
          All Posts
        </button>
        <StatusBadge status={status} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {successMessage && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{successMessage}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Title</label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Post title"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-lg font-semibold text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">URL slug</label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-neutral-400">/blog/</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugTouched(true);
                }}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="A short summary shown on listing cards and used as a fallback meta description…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-right text-[11px] text-neutral-400">{excerpt.length}/500</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Content</label>
            <BlogRichTextEditor content={content} onChange={setContent} />
            <p className="mt-1.5 text-xs text-neutral-500">
              {liveStats.wordCount} words · ~{liveStats.readingTimeMinutes || 1} min read
              {savedStats.wordCount !== null && <span className="text-neutral-400"> (as of last save: {savedStats.wordCount} words)</span>}
            </p>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => setPreviewOpen(true)} className={`flex items-center gap-1.5 ${outlineBtn}`}>
              <Icon name="eye" className="h-4 w-4" />
              Preview
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <PublishPanel
            status={status}
            isExisting={!!id}
            saving={saving}
            pendingStatus={pendingStatus}
            scheduleDate={scheduleDate}
            onScheduleDateChange={setScheduleDate}
            publishedAt={publishedAtDisplay}
            onSave={handleSave}
            onDelete={id ? handleDeletePermanently : undefined}
          />

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Featured image</h3>
            <FeaturedImagePicker
              image={featuredImage}
              onChange={(media) => {
                setFeaturedImage(media ? { mediaId: media.id, url: media.url, alt: media.altText } : null);
                if (media?.altText) setFeaturedImageAlt(media.altText);
                if (!media) setFeaturedImageAlt("");
              }}
            />
            {featuredImage && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-neutral-700">Alt text (required)</label>
                <input
                  value={featuredImageAlt}
                  onChange={(e) => setFeaturedImageAlt(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
            {!featuredImage && <MissingFieldWarning text="No featured image — cards and social shares will show a placeholder." />}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Social share image (optional)</h3>
            <p className="mt-1 text-[11px] text-neutral-400">Falls back to the featured image above when left empty.</p>
            <FeaturedImagePicker
              image={ogImage}
              onChange={(media) => setOgImage(media ? { mediaId: media.id, url: media.url } : null)}
            />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</h3>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="mt-2 w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Tags</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTagIds((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
              {tags.length === 0 && <p className="text-xs text-neutral-400">No tags yet — add some from the Tags tab.</p>}
            </div>
          </div>

          <SeoPanel
            title={title}
            seoTitle={seoTitle}
            onSeoTitleChange={setSeoTitle}
            seoDescription={seoDescription}
            onSeoDescriptionChange={setSeoDescription}
            canonicalUrl={canonicalUrl}
            onCanonicalUrlChange={setCanonicalUrl}
            excerpt={excerpt}
          />
        </div>
      </div>

      {previewOpen && (
        <PreviewModal title={title} featuredImageUrl={featuredImage?.url ?? null} content={content} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

const STATUS_LABEL: Record<BlogPostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

const STATUS_COLOR: Record<BlogPostStatus, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  scheduled: "bg-amber-100 text-amber-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-neutral-300 text-neutral-600",
};

export function StatusBadge({ status }: { status: BlogPostStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>;
}

function MissingFieldWarning({ text }: { text: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
      <Icon name="x-circle" className="mt-0.5 h-3 w-3 shrink-0" />
      {text}
    </p>
  );
}

function FeaturedImagePicker({
  image,
  onChange,
}: {
  image: { mediaId: string; url: string | null; alt?: string | null } | null;
  onChange: (media: Media | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"library" | "upload">("library");

  return (
    <div className="mt-2">
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-selected preview thumbnail
        <img src={image.url} alt="" className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
          <Icon name="image" className="h-6 w-6" />
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPickerTab("library");
            setPickerOpen(true);
          }}
          className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-400"
        >
          Select from Library
        </button>
        <button
          type="button"
          onClick={() => {
            setPickerTab("upload");
            setPickerOpen(true);
          }}
          className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:border-brand-400"
        >
          Upload
        </button>
        {image && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline">
            Remove
          </button>
        )}
      </div>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} accept="image" initialTab={pickerTab} onSelect={(media) => onChange(media)} />
    </div>
  );
}

function PublishPanel({
  status,
  isExisting,
  saving,
  pendingStatus,
  scheduleDate,
  onScheduleDateChange,
  publishedAt,
  onSave,
  onDelete,
}: {
  status: BlogPostStatus;
  isExisting: boolean;
  saving: boolean;
  pendingStatus: BlogPostStatus | null;
  scheduleDate: string;
  onScheduleDateChange: (v: string) => void;
  publishedAt: string | null;
  onSave: (status: BlogPostStatus) => void;
  onDelete?: () => void;
}) {
  // Label of the button whose request is in flight (others stay disabled).
  const busy = (target: BlogPostStatus, idle: string, working: string) => (saving && pendingStatus === target ? working : idle);
  const scheduleMin = toDateTimeLocal(new Date().toISOString());
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Publish</h3>

      {status === "published" && publishedAt && (
        <p className="mt-2 text-xs text-green-700">Published {new Date(publishedAt).toLocaleString()}</p>
      )}
      {status === "scheduled" && publishedAt && (
        <p className="mt-2 text-xs text-amber-700">Scheduled for {new Date(publishedAt).toLocaleString()}</p>
      )}
      {status === "archived" && <p className="mt-2 text-xs text-neutral-500">Archived — hidden from the public site.</p>}

      {(status === "draft" || status === "scheduled") && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-neutral-700">Schedule for later (optional)</label>
          <input
            type="datetime-local"
            value={scheduleDate}
            min={scheduleMin}
            onChange={(e) => onScheduleDateChange(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            Hidden from visitors until this time, then published automatically — no need to be logged in. Leave empty and use Publish Now to go live immediately.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {status === "draft" && (
          <>
            <button type="button" disabled={saving} onClick={() => onSave("draft")} className={outlineBtn}>
              {busy("draft", "Save Draft", "Saving…")}
            </button>
            <button type="button" disabled={saving || !scheduleDate} onClick={() => onSave("scheduled")} className={amberBtn}>
              {busy("scheduled", "Schedule", "Scheduling…")}
            </button>
            <button type="button" disabled={saving} onClick={() => onSave("published")} className={brandBtn}>
              {busy("published", "Publish Now", "Publishing…")}
            </button>
          </>
        )}
        {status === "scheduled" && (
          <>
            <button type="button" disabled={saving || !scheduleDate} onClick={() => onSave("scheduled")} className={amberBtn}>
              {busy("scheduled", "Update Schedule", "Updating…")}
            </button>
            <button type="button" disabled={saving} onClick={() => onSave("published")} className={brandBtn}>
              {busy("published", "Publish Now", "Publishing…")}
            </button>
            <button type="button" disabled={saving} onClick={() => onSave("draft")} className={ghostBtn}>
              {busy("draft", "Move to Draft", "Saving…")}
            </button>
          </>
        )}
        {status === "published" && (
          <>
            <button type="button" disabled={saving} onClick={() => onSave("published")} className={brandBtn}>
              {busy("published", "Update", "Updating…")}
            </button>
            <button type="button" disabled={saving} onClick={() => onSave("draft")} className={ghostBtn}>
              {busy("draft", "Unpublish → Draft", "Saving…")}
            </button>
            <button type="button" disabled={saving} onClick={() => onSave("archived")} className={ghostBtn}>
              {busy("archived", "Archive", "Archiving…")}
            </button>
          </>
        )}
        {status === "archived" && (
          <button type="button" disabled={saving} onClick={() => onSave("draft")} className={outlineBtn}>
            Restore to Draft
          </button>
        )}
        {isExisting && onDelete && (
          <button type="button" disabled={saving} onClick={onDelete} className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:text-red-800">
            Delete permanently
          </button>
        )}
      </div>
    </div>
  );
}

function SeoPanel({
  title,
  seoTitle,
  onSeoTitleChange,
  seoDescription,
  onSeoDescriptionChange,
  canonicalUrl,
  onCanonicalUrlChange,
  excerpt,
}: {
  title: string;
  seoTitle: string;
  onSeoTitleChange: (v: string) => void;
  seoDescription: string;
  onSeoDescriptionChange: (v: string) => void;
  canonicalUrl: string;
  onCanonicalUrlChange: (v: string) => void;
  excerpt: string;
}) {
  const effectiveTitle = seoTitle || title;
  const effectiveDescription = seoDescription || excerpt;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SEO</h3>
      <div className="mt-2 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">SEO title</label>
          <input
            value={seoTitle}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            placeholder={title || "Falls back to the post title"}
            maxLength={255}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-0.5 text-[11px] text-neutral-400">{effectiveTitle.length}/60 recommended</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Meta description</label>
          <textarea
            value={seoDescription}
            onChange={(e) => onSeoDescriptionChange(e.target.value)}
            rows={2}
            placeholder={excerpt || "Falls back to the excerpt"}
            maxLength={500}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-0.5 text-[11px] text-neutral-400">{effectiveDescription.length}/160 recommended</p>
          {!effectiveDescription && <MissingFieldWarning text="No meta description or excerpt — search engines will generate one automatically." />}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Canonical URL (optional)</label>
          <input
            value={canonicalUrl}
            onChange={(e) => onCanonicalUrlChange(e.target.value)}
            placeholder="Leave empty to use this post's own URL"
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-xs focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function PreviewModal({
  title,
  featuredImageUrl,
  content,
  onClose,
}: {
  title: string;
  featuredImageUrl: string | null;
  content: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Preview — not published</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close preview">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        {featuredImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- preview only, matches the public article layout
          <img src={featuredImageUrl} alt="" className="mb-6 h-56 w-full rounded-xl object-cover sm:h-72" />
        )}
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{title || "Untitled post"}</h1>
        <div className="blog-article-content mt-6" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}
