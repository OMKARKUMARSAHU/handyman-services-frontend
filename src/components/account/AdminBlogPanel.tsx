"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import { AdminBlogPostEditor, StatusBadge } from "@/components/account/AdminBlogPostEditor";
import {
  AuthApiError,
  createBlogCategory,
  createBlogTag,
  deleteBlogCategory,
  deleteBlogPost,
  deleteBlogTag,
  listBlogCategoriesAdmin,
  listBlogPostsAdmin,
  listBlogTagsAdmin,
  updateBlogCategory,
  updateBlogTag,
  type BlogCategory,
  type BlogPostStatus,
  type BlogPostSummary,
  type BlogTag,
} from "@/lib/admin/blog-api";

type BlogSubTab = "posts" | "categories" | "tags";

const SUB_TABS: { key: BlogSubTab; label: string }[] = [
  { key: "posts", label: "All Posts" },
  { key: "categories", label: "Categories" },
  { key: "tags", label: "Tags" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Admin sidebar "Blog" section (requirement 1). Three sub-views — All
 * Posts (list/search/filter/sort/paginate, with Add New Post leading into
 * `AdminBlogPostEditor`), Categories, and Tags — following the same
 * "tab-based SPA shell" pattern `AdminDashboardPanel`/`AdminCatalogPanel`
 * already use for every other admin surface, not a separate app.
 */
export function AdminBlogPanel() {
  const [subTab, setSubTab] = useState<BlogSubTab>("posts");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [creatingPost, setCreatingPost] = useState(false);
  // The category the admin was "in" when they started a new post -- either
  // the All Posts category filter or a row they picked in Categories. It
  // lives here (not inside the list panel) so it survives the list panel
  // unmounting while the editor is open, and so the editor can preselect it.
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [newPostCategoryId, setNewPostCategoryId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function startNewPost(categoryId: string | null) {
    setFlash(null);
    setNewPostCategoryId(categoryId);
    setCreatingPost(true);
  }

  if (creatingPost || editingPostId !== null) {
    return (
      <AdminBlogPostEditor
        postId={creatingPost ? null : editingPostId}
        initialCategoryId={creatingPost ? newPostCategoryId : null}
        onDone={(message) => {
          setCreatingPost(false);
          setEditingPostId(null);
          setNewPostCategoryId(null);
          // Returning to All Posts remounts the list, which refetches from
          // the server -- the just-saved post is therefore always shown.
          setSubTab("posts");
          setFlash(message ?? null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setSubTab(t.key);
                setFlash(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                subTab === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {subTab === "posts" && (
          <button
            type="button"
            onClick={() => startNewPost(filterCategoryId === "all" ? null : filterCategoryId)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            Add New Post
          </button>
        )}
      </div>

      {flash && (
        <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {flash}
        </p>
      )}

      <div className="mt-5">
        {subTab === "posts" && (
          <AdminBlogPostsListPanel
            onEdit={(id) => {
              setFlash(null);
              setEditingPostId(id);
            }}
            categoryId={filterCategoryId}
            onCategoryIdChange={setFilterCategoryId}
          />
        )}
        {subTab === "categories" && (
          <AdminBlogCategoriesPanel
            onAddPost={(categoryId) => startNewPost(categoryId)}
            onViewPosts={(categoryId) => {
              setFilterCategoryId(categoryId);
              setSubTab("posts");
            }}
          />
        )}
        {subTab === "tags" && <AdminBlogTagsPanel />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// All Posts
// ---------------------------------------------------------------------

const STATUS_FILTERS: { value: BlogPostStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function AdminBlogPostsListPanel({
  onEdit,
  categoryId,
  onCategoryIdChange,
}: {
  onEdit: (id: string) => void;
  categoryId: string;
  onCategoryIdChange: (id: string) => void;
}) {
  const [posts, setPosts] = useState<BlogPostSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState<BlogPostStatus | "all">("all");
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  // Guards against an older, slower response overwriting a newer one when
  // the filters change quickly (or the categories arrive mid-fetch).
  const loadSeq = useRef(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    listBlogCategoriesAdmin()
      .then((cats) => {
        setCategories(cats);
        // A category selected before we got here may have been deleted since.
        if (categoryId !== "all" && !cats.some((c) => c.id === categoryId)) onCategoryIdChange("all");
      })
      .catch(() => {})
      .finally(() => setCategoriesLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    // A category filter can only be translated to a slug once the category
    // list is known; fetching earlier would briefly show *all* posts.
    if (categoryId !== "all" && !categoriesLoaded) return;
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const categorySlug = categoryId === "all" ? undefined : categories.find((c) => c.id === categoryId)?.slug;
      const result = await listBlogPostsAdmin({
        status: status === "all" ? undefined : status,
        categorySlug,
        search: search || undefined,
        sort,
        page,
        pageSize,
      });
      if (seq !== loadSeq.current) return;
      setPosts(result.items);
      setTotal(result.total);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err instanceof AuthApiError ? err.message : "Could not load posts.");
      setPosts([]);
    }
  }, [status, categoryId, categories, categoriesLoaded, search, sort, page]);

  useEffect(() => {
    // Data fetch on mount / when filters change; `load` only sets state after awaiting the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleDelete(post: BlogPostSummary) {
    if (!window.confirm(`Permanently delete "${post.title}"? This cannot be undone — consider leaving it Archived instead.`)) return;
    setActioningId(post.id);
    try {
      await deleteBlogPost(post.id);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not delete this post.");
    } finally {
      setActioningId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search title or excerpt…"
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as BlogPostStatus | "all");
            setPage(1);
          }}
          className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(e) => {
            onCategoryIdChange(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest" | "title")}
          className="rounded-lg border border-neutral-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title (A–Z)</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {posts === null && !error && <p className="mt-6 text-sm text-neutral-500">Loading…</p>}
      {posts !== null && posts.length === 0 && !error && <p className="mt-6 text-sm text-neutral-500">No posts match these filters.</p>}

      {posts !== null && posts.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <button type="button" onClick={() => onEdit(post.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-neutral-900">{post.title}</p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  /blog/{post.slug} · {post.authorName} · {post.category?.name ?? "Uncategorized"}
                  {post.readingTimeMinutes ? ` · ${post.readingTimeMinutes} min read` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  Updated {new Date(post.updatedAt).toLocaleDateString()}
                  {post.publishedAt && post.status === "scheduled" ? ` · Scheduled for ${new Date(post.publishedAt).toLocaleString()}` : ""}
                  {post.publishedAt && post.status !== "scheduled" ? ` · Published ${new Date(post.publishedAt).toLocaleDateString()}` : ""}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <StatusBadge status={post.status} />
                <button
                  type="button"
                  onClick={() => onEdit(post.id)}
                  className="rounded border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100"
                  aria-label="Edit post"
                >
                  <Icon name="pencil" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={actioningId === post.id}
                  onClick={() => handleDelete(post)}
                  className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Delete post"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {posts !== null && posts.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {page} of {totalPages} · {total} post{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-neutral-300 px-2.5 py-1 font-medium text-neutral-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-neutral-300 px-2.5 py-1 font-medium text-neutral-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

function AdminBlogCategoriesPanel({
  onAddPost,
  onViewPosts,
}: {
  onAddPost: (categoryId: string) => void;
  onViewPosts: (categoryId: string) => void;
}) {
  const [items, setItems] = useState<BlogCategory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listBlogCategoriesAdmin());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load categories.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Data fetch on mount / when filters change; `load` only sets state after awaiting the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleAdd() {
    if (!name.trim() || !slug.trim()) {
      setError("Both a name and a slug are required.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await createBlogCategory({ name: name.trim(), slug: slugify(slug) });
      setName("");
      setSlug("");
      setSlugTouched(false);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not create this category.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(c: BlogCategory) {
    try {
      await updateBlogCategory(c.id, { active: !c.active });
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not update this category.");
    }
  }

  async function handleDelete(c: BlogCategory) {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try {
      await deleteBlogCategory(c.id);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not delete this category.");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Blog Categories</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Editorial categories for organizing articles — separate from the storefront&apos;s service categories.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-neutral-50 p-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-700">Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-700">Slug</label>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
        <button
          type="button"
          disabled={adding}
          onClick={handleAdd}
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add Category
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {items === null && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {items !== null && items.length === 0 && <p className="mt-4 text-sm text-neutral-500">No categories yet.</p>}

      {items !== null && items.length > 0 && (
        <ul className="mt-4 divide-y divide-neutral-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <button type="button" onClick={() => onViewPosts(c.id)} className="text-left" title={`View posts in ${c.name}`}>
                <p className="text-sm font-medium text-neutral-900 hover:underline">{c.name}</p>
                <p className="text-xs text-neutral-500">/{c.slug}</p>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddPost(c.id)}
                  className="flex items-center gap-1 rounded border border-brand-300 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                  Add post
                </button>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                  {c.active ? "Active" : "Inactive"}
                </span>
                <button type="button" onClick={() => handleToggleActive(c)} className="rounded border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100">
                  <Icon name={c.active ? "eye" : "eye-off"} className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(c)} className="rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------

function AdminBlogTagsPanel() {
  const [items, setItems] = useState<BlogTag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await listBlogTagsAdmin());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not load tags.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Data fetch on mount / when filters change; `load` only sets state after awaiting the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleAdd() {
    if (!name.trim()) return;
    setError(null);
    try {
      await createBlogTag({ name: name.trim(), slug: slugify(name) });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not create this tag.");
    }
  }

  async function handleRename(tag: BlogTag) {
    const next = window.prompt("Rename tag", tag.name);
    if (!next || !next.trim() || next.trim() === tag.name) return;
    try {
      await updateBlogTag(tag.id, { name: next.trim(), slug: slugify(next) });
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not rename this tag.");
    }
  }

  async function handleDelete(tag: BlogTag) {
    if (!window.confirm(`Delete tag "${tag.name}"? It will be removed from any posts that have it.`)) return;
    try {
      await deleteBlogTag(tag.id);
      await load();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Could not delete this tag.");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-base font-semibold text-neutral-900">Blog Tags</h2>

      <div className="mt-4 flex items-end gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm"
        />
        <button type="button" onClick={handleAdd} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
          Add Tag
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {items === null && <p className="mt-4 text-sm text-neutral-500">Loading…</p>}
      {items !== null && items.length === 0 && <p className="mt-4 text-sm text-neutral-500">No tags yet.</p>}

      {items !== null && items.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700">
              <button type="button" onClick={() => handleRename(t)} className="font-medium hover:underline">
                {t.name}
              </button>
              <button type="button" onClick={() => handleDelete(t)} aria-label={`Delete tag ${t.name}`} className="text-neutral-400 hover:text-red-600">
                <Icon name="x" className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
