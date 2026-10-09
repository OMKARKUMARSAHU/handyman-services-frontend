/**
 * Resolves an admin-entered "external video link" into something that can
 * actually be played — the root-cause fix for "YouTube URLs don't
 * reliably play on the public homepage."
 *
 * The bug this replaces: every external link, regardless of shape, was
 * dropped straight into an iframe pointed right at it (VideoCurationModal.tsx).
 * A YouTube watch, Shorts, or share link (e.g.
 * "https://youtube.com/shorts/E6bMmUpUHFQ?si=...") is not an embeddable
 * URL — YouTube only allows framing its dedicated "embed" path, so a raw
 * watch/shorts/youtu.be link inside an iframe renders blank or is refused
 * outright. A direct video file link (a bare .mp4/.webm/.mov URL) has the
 * opposite problem: it should go through a native video element, not an
 * iframe, which many browsers render inconsistently for raw media URLs.
 * Centralizing the decision here means every place a "video" can come
 * from an external link (the public modal, the admin's own preview) makes
 * the same call, instead of three copies of ad-hoc URL sniffing.
 */

export type VideoEmbedKind = "youtube" | "file" | "generic";

export interface VideoEmbedInfo {
  /** "youtube" -> render an <iframe> at embedUrl. "file" -> render a <video> at embedUrl (it's a direct media file, external or not). "generic" -> best-effort <iframe>; pair with a visible "Open video" link since many sites refuse to be framed and that failure isn't detectable from here. */
  kind: VideoEmbedKind;
  embedUrl: string;
  /** The original, unmodified URL — always safe to open directly in a new tab, used for the fallback link and for "could not be embedded" error states. */
  originalUrl: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const DIRECT_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"];

function extractYouTubeId(u: URL): string | null {
  const host = u.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host.endsWith("youtu.be")) {
    // https://youtu.be/<id>[?...]
    const id = u.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }

  // https://www.youtube.com/watch?v=<id>
  const vParam = u.searchParams.get("v");
  if (vParam) return vParam;

  // https://www.youtube.com/shorts/<id>, /embed/<id>, /live/<id>
  const parts = u.pathname.split("/").filter(Boolean);
  const markers = ["shorts", "embed", "live", "v"];
  for (let i = 0; i < parts.length - 1; i++) {
    if (markers.includes(parts[i].toLowerCase())) return parts[i + 1];
  }
  return null;
}

/** Accepts YouTube's "t"/"start" query param in either plain-seconds ("90") or "1h2m3s" form. */
function parseStartSeconds(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m) return null;
  const [, h, min, s] = m;
  if (!h && !min && !s) return null;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/**
 * Classifies one external video URL. Returns `null` when the string isn't
 * even a well-formed http(s) URL, so callers can show a clear "that
 * doesn't look like a valid video link" message instead of trying to embed
 * garbage.
 */
export function resolveVideoEmbed(rawUrl: string | null | undefined): VideoEmbedInfo | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const youTubeId = extractYouTubeId(parsed);
  if (youTubeId) {
    const startRaw = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
    const startSeconds = startRaw ? parseStartSeconds(startRaw) : null;
    const embed = new URL(`https://www.youtube.com/embed/${encodeURIComponent(youTubeId)}`);
    embed.searchParams.set("rel", "0");
    embed.searchParams.set("modestbranding", "1");
    if (startSeconds) embed.searchParams.set("start", String(startSeconds));
    return { kind: "youtube", embedUrl: embed.toString(), originalUrl: trimmed };
  }

  const pathLower = parsed.pathname.toLowerCase();
  if (DIRECT_VIDEO_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) {
    return { kind: "file", embedUrl: trimmed, originalUrl: trimmed };
  }

  // Unrecognized external link (Vimeo, a provider's own page, etc.) --
  // attempt a generic iframe embed, but every caller must pair this with
  // a visible "open the video directly" link: a cross-origin page that
  // refuses to be framed (X-Frame-Options/CSP) fails silently from here,
  // with no onError this code can observe.
  return { kind: "generic", embedUrl: trimmed, originalUrl: trimmed };
}

export { extractYouTubeId as __extractYouTubeIdForTests, parseStartSeconds as __parseStartSecondsForTests };
