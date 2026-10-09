"use client";

import { useEffect, useState } from "react";
import { Node } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Icon } from "@/lib/icons";
import { MediaPicker } from "@/components/account/MediaPicker";
import type { Media } from "@/lib/admin/media-library-api";
import { resolveVideoEmbed, type VideoEmbedInfo } from "@/lib/video/embed";

/**
 * Blog post body editor (requirement 2 — "a proper rich-text/block
 * editor"). TipTap/ProseMirror, actively maintained, React-19/Next-16
 * compatible (verified against the installed `@tiptap/react@3.31.4`
 * peer-dependency range before adding it — see
 * PHASE-level notes). Produces plain HTML (`editor.getHTML()`), which the
 * backend sanitizes again on save (`blogPosts.service.ts`'s
 * `SANITIZE_OPTIONS`) — the allow-list there is kept deliberately in
 * lockstep with what this toolbar can actually produce (no code blocks,
 * no horizontal rule, no raw embeds outside YouTube/uploaded video) so
 * nothing a writer inserts here is silently stripped on save.
 *
 * Video is NOT one of the stock TipTap extensions (the official one only
 * handles YouTube) — `VideoBlockNode` below is a small custom atom node
 * that renders either a native `<video>` (direct upload, via the Media
 * Library) or a restricted YouTube `<iframe>`, reusing the exact same
 * `resolveVideoEmbed()` the homepage Video Showcase already uses, so a
 * pasted YouTube watch/Shorts/youtu.be link behaves identically here.
 */

const VideoBlockNode = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      kind: { default: "file" },
      poster: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (el: unknown) => {
          if (!(el instanceof HTMLElement)) return false;
          return { src: el.getAttribute("src"), kind: "file", poster: el.getAttribute("poster") };
        },
      },
      {
        tag: "iframe",
        getAttrs: (el: unknown) => {
          if (!(el instanceof HTMLElement)) return false;
          const src = el.getAttribute("src") || "";
          if (!src.includes("youtube.com/embed")) return false;
          return { src, kind: "youtube", poster: null };
        },
      },
    ];
  },

  renderHTML({ node }: { node: { attrs: Record<string, unknown> } }) {
    const { kind, src, poster } = node.attrs as { kind: string; src: string | null; poster: string | null };
    if (!src) return ["span", {}];
    if (kind === "youtube") {
      return [
        "iframe",
        {
          src,
          width: "640",
          height: "360",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowfullscreen: "true",
          frameborder: "0",
          title: "Embedded video",
        },
      ];
    }
    return ["video", { src, controls: "true", preload: "metadata", ...(poster ? { poster } : {}) }];
  },
});

export function BlogRichTextEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disabled: not in requirement 2's list, and kept out of the
        // backend sanitizer's allow-list on purpose — leaving these off
        // here means nothing a writer can produce in this toolbar is
        // ever silently stripped by the server-side sanitizer on save.
        code: false,
        codeBlock: false,
        horizontalRule: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer nofollow" },
        },
      }),
      ImageExtension.configure({ inline: false }),
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Placeholder.configure({ placeholder: "Start writing your article…" }),
      VideoBlockNode,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getHTML()),
  });

  // Keeps the editor in sync when `content` changes from outside this
  // component — e.g. the admin editor's async "load this post" effect
  // resolving after the editor already mounted with an empty string, or
  // switching from "new post" to editing an existing one without
  // unmounting. Guarded by an equality check so this never fights the
  // user's own typing (onUpdate already keeps the parent's state current).
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      // TipTap v3: setContent's second argument is an options object
      // ({emitUpdate?, parseOptions?}), not the v2 boolean flag — passing
      // `false` directly no longer type-checks. `emitUpdate: false` is the
      // same intent as the old `false`: this is an external sync, not a
      // user edit, so it must not re-fire `onUpdate` (which would otherwise
      // feed straight back into the parent's own state and fight this effect).
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) {
    return <div className="rounded-lg border border-neutral-300 p-4 text-sm text-neutral-400">Loading editor…</div>;
  }

  return (
    <div className="tiptap-editor rounded-lg border border-neutral-300">
      <Toolbar editor={editor} onInsertImage={() => setImagePickerOpen(true)} onInsertVideo={() => setVideoDialogOpen(true)} />
      <EditorContent editor={editor} className="max-h-[70vh] min-h-[320px] overflow-y-auto px-4 py-3 focus:outline-none" />

      <MediaPicker
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        accept="image"
        onSelect={(media: Media) => {
          editor.chain().focus().setImage({ src: media.url, alt: media.altText ?? "" }).run();
        }}
      />

      {videoDialogOpen && (
        <VideoInsertDialog
          onClose={() => setVideoDialogOpen(false)}
          onInsertFile={(media) => {
            editor.commands.insertContent({ type: "video", attrs: { src: media.url, kind: "file" } });
          }}
          onInsertUrl={(embed) => {
            editor.commands.insertContent({
              type: "video",
              attrs: { src: embed.embedUrl, kind: embed.kind === "youtube" ? "youtube" : "file" },
            });
          }}
        />
      )}
    </div>
  );
}

function Toolbar({
  editor,
  onInsertImage,
  onInsertVideo,
}: {
  editor: Editor;
  onInsertImage: () => void;
  onInsertVideo: () => void;
}) {
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  function openLinkPrompt() {
    const existing = editor.getAttributes("link").href as string | undefined;
    setLinkValue(existing ?? "");
    setLinkPromptOpen(true);
  }

  function applyLink() {
    if (!linkValue.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkValue.trim() }).run();
    }
    setLinkPromptOpen(false);
  }

  return (
    <div className="border-b border-neutral-200 p-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        <BlockTypeSelect editor={editor} />
        <Divider />
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon="bold" label="Bold" />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon="italic" label="Italic" />
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          icon="underline"
          label="Underline"
        />
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          icon="strikethrough"
          label="Strikethrough"
        />
        <Divider />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon="list"
          label="Bullet list"
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon="list-ordered"
          label="Numbered list"
        />
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon="quote"
          label="Quote"
        />
        <Divider />
        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          icon="align-left"
          label="Align left"
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          icon="align-center"
          label="Align center"
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          icon="align-right"
          label="Align right"
        />
        <ToolbarButton
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          icon="align-justify"
          label="Justify"
        />
        <Divider />
        <ToolbarButton active={editor.isActive("link")} onClick={openLinkPrompt} icon="link" label="Link" />
        <ToolbarButton active={false} onClick={onInsertImage} icon="image" label="Insert image" />
        <ToolbarButton active={false} onClick={onInsertVideo} icon="video" label="Insert video" />
        <Divider />
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          icon="undo"
          label="Undo"
        />
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          icon="redo"
          label="Redo"
        />
      </div>

      {linkPromptOpen && (
        <div className="mt-1.5 flex items-center gap-2 border-t border-neutral-100 pt-1.5">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://… (leave empty to remove the link)"
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <button type="button" onClick={applyLink} className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white">
            Apply
          </button>
          <button
            type="button"
            onClick={() => setLinkPromptOpen(false)}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function BlockTypeSelect({ editor }: { editor: Editor }) {
  const current = ([1, 2, 3, 4, 5, 6] as const).find((level) => editor.isActive("heading", { level }));
  const value = current ? `h${current}` : "p";

  function handleChange(next: string) {
    if (next === "p") {
      editor.chain().focus().setParagraph().run();
      return;
    }
    const level = Number(next.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    editor.chain().focus().toggleHeading({ level }).run();
  }

  return (
    <select
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Text style"
      className="rounded border border-neutral-300 px-1.5 py-1 text-xs text-neutral-700 focus:border-brand-500 focus:outline-none"
    >
      <option value="p">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
    </select>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`rounded p-1.5 transition-colors ${
        active ? "bg-brand-50 text-brand-700" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />;
}

function VideoInsertDialog({
  onClose,
  onInsertFile,
  onInsertUrl,
}: {
  onClose: () => void;
  onInsertFile: (media: Media) => void;
  onInsertUrl: (embed: VideoEmbedInfo) => void;
}) {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleAddUrl() {
    const resolved = resolveVideoEmbed(url);
    if (!resolved) {
      setError("That doesn't look like a valid video URL.");
      return;
    }
    // Only YouTube and direct video files survive the backend's sanitizer
    // (`allowedIframeHostnames: ["www.youtube.com"]`) — rejecting a
    // "generic" link here, with an explanation, is better than letting an
    // admin insert something that silently disappears on save.
    if (resolved.kind === "generic") {
      setError(
        "This link can't be embedded in an article — only YouTube links or an uploaded video file are supported here."
      );
      return;
    }
    onInsertUrl(resolved);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Insert video</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-1 border-b border-neutral-200">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`border-b-2 px-3 py-2 text-xs font-medium ${
              mode === "url" ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500"
            }`}
          >
            YouTube link
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`border-b-2 px-3 py-2 text-xs font-medium ${
              mode === "upload" ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500"
            }`}
          >
            Upload / Media Library
          </button>
        </div>

        {mode === "url" ? (
          <div className="mt-4 space-y-2">
            <input
              autoFocus
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleAddUrl}
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Insert
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-brand-400"
            >
              <Icon name="upload" className="mr-1.5 inline h-3.5 w-3.5" />
              Choose a video file
            </button>
          </div>
        )}

        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          accept="video"
          onSelect={(media) => {
            onInsertFile(media);
            setPickerOpen(false);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
