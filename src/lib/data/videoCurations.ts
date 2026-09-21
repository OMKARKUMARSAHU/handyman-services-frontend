import videoCurationsData from "@/data/video-curations.json";
import type { VideoCuration } from "@/types";

/**
 * "Video Curations" homepage section (Phase 3 revision) — admin-curated
 * entries, active-filtered and sort-ordered, same read shape as every
 * other homepage content list in the DAL (see testimonials.ts/faqs.ts).
 * Every entry in the current mock data has `thumbnail`/`videoUrl: null` —
 * no real footage exists yet — which `VideoCurationCard` renders as an
 * honest placeholder rather than a fabricated image or a broken embed.
 */
export function getVideoCurations(): VideoCuration[] {
  return (videoCurationsData as VideoCuration[])
    .filter((v) => v.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getVideoCurationByIdSync(id: string): VideoCuration | undefined {
  return (videoCurationsData as VideoCuration[]).find((v) => v.id === id);
}
