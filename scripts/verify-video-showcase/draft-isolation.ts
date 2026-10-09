// Standalone reproduction of the admin draft reducer logic from
// src/components/account/AdminHomepageContentPanel.tsx (toVideoDraftList,
// clipItemToDraft, dedupeId, updateCard, and the save-payload builder) --
// isolated here, with no React/DOM, so the per-card isolation and
// id-collision hardening can be exercised as a plain unit test. This is a
// faithful MIRROR of that file's logic, not an import of it (those
// functions aren't exported from a "use client" component module) --
// if that file's draft/save logic changes, update this mirror to match.
// Run with: npx tsx scripts/verify-video-showcase/draft-isolation.ts

interface VideoClipDraft {
  id: string;
  title: string;
  videoUrl: string | null;
  externalUrl: string;
  thumbnail: string | null;
  durationSeconds: string;
}
interface VideoCurationDraft {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  serviceTypeId: string;
  thumbnail: string | null;
  videoUrl: string | null;
  externalUrl: string;
  durationSeconds: string;
  active: boolean;
  clips: VideoClipDraft[];
}
type RawClip = Record<string, string | number | null | undefined>;
type RawItem = Record<string, string | number | RawClip[] | undefined>;

let counter = 0;
function newId(): string {
  counter++;
  return `id-${counter}`;
}

function clipItemToDraft(raw: RawClip): VideoClipDraft {
  return {
    id: String(raw.id ?? newId()),
    title: raw.title != null ? String(raw.title) : "",
    videoUrl: raw.videoUrl != null ? String(raw.videoUrl) : null,
    externalUrl: raw.externalUrl != null ? String(raw.externalUrl) : "",
    thumbnail: raw.thumbnail != null ? String(raw.thumbnail) : null,
    durationSeconds: raw.durationSeconds != null ? String(raw.durationSeconds) : "",
  };
}

function dedupeId<T extends { id: string }>(item: T, seen: Set<string>): T {
  if (seen.has(item.id)) return { ...item, id: newId() };
  seen.add(item.id);
  return item;
}

function toVideoDraftList(items: RawItem[] | null | undefined): VideoCurationDraft[] {
  if (!items) return [];
  const seenCardIds = new Set<string>();
  return items.map((it) => {
    const rawClips = it.clips;
    const seenClipIds = new Set<string>();
    const clips = Array.isArray(rawClips) ? rawClips.map((c) => dedupeId(clipItemToDraft(c), seenClipIds)) : [];
    const card: VideoCurationDraft = {
      id: String(it.id ?? newId()),
      title: String(it.title ?? ""),
      description: it.description !== undefined ? String(it.description) : "",
      categoryId: it.categoryId !== undefined ? String(it.categoryId) : "",
      serviceTypeId: it.serviceTypeId !== undefined ? String(it.serviceTypeId) : "",
      thumbnail: it.thumbnail !== undefined ? String(it.thumbnail) : null,
      videoUrl: it.videoUrl !== undefined ? String(it.videoUrl) : null,
      externalUrl: it.externalUrl !== undefined ? String(it.externalUrl) : "",
      durationSeconds: it.durationSeconds !== undefined ? String(it.durationSeconds) : "",
      active: it.active === undefined || Number(it.active) === 1,
      clips,
    };
    return dedupeId(card, seenCardIds);
  });
}

function updateCard(draft: VideoCurationDraft[], i: number, patch: Partial<VideoCurationDraft>): VideoCurationDraft[] {
  return draft.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
}

function buildSaveItems(draft: VideoCurationDraft[]) {
  return draft.map((card, idx) => {
    const out: Record<string, unknown> = { id: card.id, title: card.title, sortOrder: idx, active: card.active ? 1 : 0 };
    if (card.videoUrl) out.videoUrl = card.videoUrl;
    if (card.externalUrl) out.externalUrl = card.externalUrl;
    if (card.clips.length > 0) {
      out.clips = card.clips.map((clip) => {
        const c: Record<string, unknown> = { id: clip.id };
        if (clip.videoUrl) c.videoUrl = clip.videoUrl;
        if (clip.externalUrl) c.externalUrl = clip.externalUrl;
        return c;
      });
    }
    return out;
  });
}

let failed = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (!cond) failed++;
}

// ---- Test 1: three named cards, each independently stable ----
const seeded: RawItem[] = [
  { id: "vc-technician-visit", title: "What a Technician Visit Looks Like" },
  { id: "vc-ac-installation", title: "AC Installation Walkthrough" },
  { id: "vc-washing-machine-service", title: "Washing Machine Service" },
  { id: "vc-chimney-deep-clean", title: "Chimney Deep Clean" },
];
let draft = toVideoDraftList(seeded);
check("4 cards loaded with their own stable ids", draft.map((c) => c.id).join(",") === "vc-technician-visit,vc-ac-installation,vc-washing-machine-service,vc-chimney-deep-clean");

// Admin sets the AC Installation card's (index 1) main video only.
const acIndex = draft.findIndex((c) => c.id === "vc-ac-installation");
draft = updateCard(draft, acIndex, { videoUrl: "https://cdn.example.com/library/video/ac-install.mp4" });

check("Updating Card A (AC Installation) does not change Card B (Washing Machine)", draft[2].videoUrl === null);
check("Updating Card A does not change Card C (Chimney Deep Clean)", draft[3].videoUrl === null);
check("Updating Card A does not change Card D (Technician Visit)", draft[0].videoUrl === null);
check("Card A actually has its own video now", draft[acIndex].videoUrl === "https://cdn.example.com/library/video/ac-install.mp4");

// Reordering preserves ownership: move AC Installation (index 1) up to index 0.
const reordered = [draft[1], draft[0], draft[2], draft[3]];
check(
  "Reordering cards preserves video ownership (AC Installation keeps its video after moving)",
  reordered[0].id === "vc-ac-installation" && reordered[0].videoUrl === "https://cdn.example.com/library/video/ac-install.mp4"
);
check("The card that moved into AC's old slot (Technician Visit) has no video", reordered[1].videoUrl === null);

// Reloading (simulating a save + refetch) preserves exactly what was set.
const saved = buildSaveItems(draft);
const reloaded = toVideoDraftList(saved as RawItem[]);
check(
  "Reloading after Save preserves each card's video (round-trip through the save payload)",
  reloaded.find((c) => c.id === "vc-ac-installation")?.videoUrl === "https://cdn.example.com/library/video/ac-install.mp4" &&
    reloaded.find((c) => c.id === "vc-washing-machine-service")?.videoUrl === null
);

// ---- Test 2: duplicate ids in stored data (legacy/corrupted rows) get repaired, not merged ----
const corrupted: RawItem[] = [
  { id: "dup-id", title: "Card One (should keep its own identity)" },
  { id: "dup-id", title: "Card Two (duplicate id in the stored data)" },
];
const repaired = toVideoDraftList(corrupted);
check("Duplicate stored ids are repaired into two distinct ids", repaired[0].id !== repaired[1].id);
check("Repair doesn't touch the first occurrence's id", repaired[0].id === "dup-id");
check("Titles stay attached to the right card after the repair (no merge/bleed)", repaired[0].title === "Card One (should keep its own identity)" && repaired[1].title === "Card Two (duplicate id in the stored data)");

// ---- Test 3: a card without a video never inherits another's ----
const mixed: RawItem[] = [
  { id: "has-video", title: "Has video", videoUrl: "https://cdn.example.com/a.mp4" },
  { id: "no-video", title: "No video" },
];
const mixedDraft = toVideoDraftList(mixed);
check("A card without a video stays null, never inheriting a sibling's video", mixedDraft[1].videoUrl === null);

// ---- Test 4: editing/removing a clip only affects its own parent card ----
const withClips: RawItem[] = [
  { id: "card-a", title: "A", clips: [{ id: "clip-1", videoUrl: "https://cdn.example.com/a1.mp4" }] },
  { id: "card-b", title: "B", clips: [{ id: "clip-1", videoUrl: "https://cdn.example.com/b1.mp4" }] }, // same clip id, different card -- legitimate, must not collide
];
const clipsDraft = toVideoDraftList(withClips);
const cardA = clipsDraft.find((c) => c.id === "card-a")!;
const cardB = clipsDraft.find((c) => c.id === "card-b")!;
check("Two different cards' clips sharing the same clip id stay independent", cardA.clips[0].videoUrl === "https://cdn.example.com/a1.mp4" && cardB.clips[0].videoUrl === "https://cdn.example.com/b1.mp4");
const cardAWithRemovedClip = { ...cardA, clips: cardA.clips.filter((c) => c.id !== "clip-1") };
check("Removing a clip from Card A leaves Card B's identical-id clip untouched", cardAWithRemovedClip.clips.length === 0 && cardB.clips.length === 1);

// ---- Test 5: legacy single-video card (no clips array at all) still works ----
const legacy: RawItem[] = [{ id: "legacy-card", title: "Legacy", videoUrl: "https://cdn.example.com/legacy.mp4" }];
const legacyDraft = toVideoDraftList(legacy);
check("Legacy single-video card (no clips field) parses with an empty clips array and its videoUrl intact", legacyDraft[0].clips.length === 0 && legacyDraft[0].videoUrl === "https://cdn.example.com/legacy.mp4");

console.log(`\n${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
if (failed > 0) process.exit(1);
