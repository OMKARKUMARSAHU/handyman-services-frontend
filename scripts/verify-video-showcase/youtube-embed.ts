// Exercises src/lib/video/embed.ts (the real implementation, imported
// directly -- not a mirror) against the required URL shapes: YouTube
// Shorts, a standard YouTube watch link, youtu.be, an already-embed URL,
// a direct MP4/WebM file link, an unrecognized external link, and
// invalid/empty input.
// Run with: npx tsx scripts/verify-video-showcase/youtube-embed.ts
import { resolveVideoEmbed } from "../../src/lib/video/embed";

type Case = { name: string; input: string | null; expect: (r: ReturnType<typeof resolveVideoEmbed>) => boolean };

const cases: Case[] = [
  {
    name: "YouTube Shorts URL (the exact URL from the task)",
    input: "https://youtube.com/shorts/E6bMmUpUHFQ?si=h2uo0pWMD8zjR7Ex",
    expect: (r) => r?.kind === "youtube" && r.embedUrl === "https://www.youtube.com/embed/E6bMmUpUHFQ?rel=0&modestbranding=1",
  },
  {
    name: "Standard YouTube watch URL",
    input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43s",
    expect: (r) =>
      r?.kind === "youtube" &&
      r.embedUrl === "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&start=43",
  },
  {
    name: "youtu.be short link",
    input: "https://youtu.be/dQw4w9WgXcQ",
    expect: (r) => r?.kind === "youtube" && r.embedUrl.startsWith("https://www.youtube.com/embed/dQw4w9WgXcQ"),
  },
  {
    name: "Already-an-embed YouTube URL passes through",
    input: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    expect: (r) => r?.kind === "youtube" && r.embedUrl.startsWith("https://www.youtube.com/embed/dQw4w9WgXcQ"),
  },
  {
    name: "Direct MP4 URL still plays as a <video>, not an <iframe>",
    input: "https://cdn.example.com/videos/ac-install.mp4",
    expect: (r) => r?.kind === "file" && r.embedUrl === "https://cdn.example.com/videos/ac-install.mp4",
  },
  {
    name: "Direct WebM / MOV URLs are also files",
    input: "https://cdn.example.com/clip.webm",
    expect: (r) => r?.kind === "file",
  },
  {
    name: "Unknown external link (e.g. Vimeo) falls back to generic iframe + original URL preserved for the fallback link",
    input: "https://vimeo.com/76979871",
    expect: (r) => r?.kind === "generic" && r.originalUrl === "https://vimeo.com/76979871",
  },
  {
    name: "Garbage / non-URL text returns null (caller shows a validation error, never a broken embed)",
    input: "not a url at all",
    expect: (r) => r === null,
  },
  {
    name: "Empty string returns null",
    input: "",
    expect: (r) => r === null,
  },
  {
    name: "null input returns null",
    input: null,
    expect: (r) => r === null,
  },
];

let failed = 0;
for (const c of cases) {
  const result = resolveVideoEmbed(c.input);
  const ok = c.expect(result);
  console.log(`${ok ? "PASS" : "FAIL"} — ${c.name}`, ok ? "" : JSON.stringify(result));
  if (!ok) failed++;
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed > 0) process.exit(1);
