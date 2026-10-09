// Regression tests for the Video Showcase's pure logic -- they import the
// REAL modules the admin editor and the public player use (no mirrored
// copies), so a regression in those modules fails here.
// Run: npx tsx scripts/verify-video-showcase/video-showcase.test.ts
import assert from "node:assert/strict";
import { createDirtyTracker } from "../../src/lib/admin/dirtyTracker";
import {
  buildVideoSavePayload,
  countPlayableVideos,
  toVideoDraftList,
  type VideoCurationDraft,
} from "../../src/lib/admin/videoShowcaseDraft";
import { buildPlaylist, cleanUrl, resolveActiveEntry, stepPlaylist } from "../../src/lib/video/playlist";
import { makeUniqueId } from "../../src/lib/video/identity";
import type { HomepageSectionItem } from "../../src/lib/admin/content-api";
import type { VideoCuration } from "../../src/types";

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${(err as Error).message}`);
  }
}

const clip = (id: string, url: string, extra: Record<string, string> = {}) => ({ id, externalUrl: url, ...extra });
const stored = (id: string, extra: Record<string, unknown> = {}): HomepageSectionItem =>
  ({ id, title: `Card ${id}`, sortOrder: 0, active: 1, ...extra }) as HomepageSectionItem;
const curation = (id: string, extra: Partial<VideoCuration> = {}): VideoCuration => ({
  id,
  title: `Card ${id}`,
  thumbnail: null,
  videoUrl: null,
  sortOrder: 0,
  active: true,
  ...extra,
});

console.log("playlist (what each card's player shows)");

test("1 removing the main video leaves no trace of it in the payload or the playlist", () => {
  const drafts = toVideoDraftList([stored("a", { videoUrl: "/old.mp4", externalUrl: "https://panda.example/v1" })]);
  drafts[0]!.videoUrl = null;
  drafts[0]!.externalUrl = "";
  const [saved] = buildVideoSavePayload(drafts);
  assert.equal("videoUrl" in saved!, false);
  assert.equal("externalUrl" in saved!, false);
  assert.equal(JSON.stringify(saved).includes("old.mp4"), false);
  assert.equal(JSON.stringify(saved).includes("panda"), false);
  assert.deepEqual(buildPlaylist(curation("a", { videoUrl: null, externalUrl: null })), []);
});

test("1b the string 'null'/'' never counts as a video (what String(null) used to produce)", () => {
  assert.equal(cleanUrl("null"), null);
  assert.equal(cleanUrl("  "), null);
  assert.equal(cleanUrl(null), null);
  assert.deepEqual(buildPlaylist(curation("a", { videoUrl: "null", externalUrl: "" })), []);
  assert.equal(toVideoDraftList([stored("a", { videoUrl: "null" })])[0]!.videoUrl, null);
});

test("2 an empty card has an empty playlist (public UI shows 'Video coming soon') and no active entry", () => {
  const p = buildPlaylist(curation("empty"));
  assert.equal(p.length, 0);
  assert.equal(resolveActiveEntry(p, null), null);
});

for (const n of [1, 2, 4]) {
  test(`${({ 1: 3, 2: 4, 4: 5 } as Record<number, number>)[n]} a card with ${n} clip(s) and no main video plays exactly ${n}, all its own`, () => {
    const c = curation("wm", { clips: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, externalUrl: `https://x.test/wm-${i}.mp4` })) });
    const p = buildPlaylist(c);
    assert.equal(p.length, n);
    assert.ok(p.every((e) => e.id.startsWith("wm::clip::") && e.externalUrl!.includes("/wm-")));
  });
}

test("a main video plus clips is main first, then exactly the card's own clips", () => {
  const c = curation("ac", { videoUrl: "/ac-main.mp4", clips: [{ id: "c1", videoUrl: "/ac-1.mp4" }, { id: "c2", videoUrl: "/ac-2.mp4" }] });
  const p = buildPlaylist(c);
  assert.deepEqual(p.map((e) => e.kind), ["main", "clip", "clip"]);
  assert.deepEqual(p.map((e) => e.videoUrl), ["/ac-main.mp4", "/ac-1.mp4", "/ac-2.mp4"]);
});

test("a clip with no source is not offered as a playable video", () => {
  const c = curation("x", { videoUrl: "/m.mp4", clips: [{ id: "bad", videoUrl: null, externalUrl: "" }, { id: "ok", videoUrl: "/ok.mp4" }] });
  assert.equal(buildPlaylist(c).length, 2);
});

test("7 a selection made on one card never carries over to another card", () => {
  const a = buildPlaylist(curation("A", { clips: [clip("1", "https://x.test/a1.mp4"), clip("2", "https://x.test/a2.mp4")] }));
  const b = buildPlaylist(curation("B", { clips: [clip("1", "https://x.test/b1.mp4"), clip("2", "https://x.test/b2.mp4")] }));
  const selectedOnA = a[1]!.id;
  assert.equal(resolveActiveEntry(a, selectedOnA)!.externalUrl, "https://x.test/a2.mp4");
  // Same clip ids ("2") on both cards, but the entry ids embed the card id.
  assert.equal(resolveActiveEntry(b, selectedOnA)!.externalUrl, "https://x.test/b1.mp4");
  assert.equal(new Set([...a, ...b].map((e) => e.id)).size, 4);
});

test("a stale selection past the end of a shorter card falls back to its first video", () => {
  const long = buildPlaylist(curation("L", { clips: [clip("1", "https://x/1.mp4"), clip("2", "https://x/2.mp4"), clip("3", "https://x/3.mp4")] }));
  const short = buildPlaylist(curation("S", { clips: [clip("1", "https://x/s1.mp4")] }));
  assert.equal(resolveActiveEntry(short, long[2]!.id)!.externalUrl, "https://x/s1.mp4");
});

console.log("admin draft <-> stored mapping");

test("6 editing one card or clip does not change any other card", () => {
  const items = [
    stored("a", { videoUrl: "/a.mp4", clips: [clip("a1", "https://x/a1.mp4")] }),
    stored("b", { videoUrl: "/b.mp4", clips: [clip("b1", "https://x/b1.mp4"), clip("b2", "https://x/b2.mp4")] }),
    stored("c", { thumbnail: "/c.png" }),
  ];
  const before = JSON.parse(JSON.stringify(buildVideoSavePayload(toVideoDraftList(items))));
  const drafts = toVideoDraftList(items);
  drafts[1]!.clips[0]!.externalUrl = "https://x/b1-new.mp4";
  drafts[1]!.clips[0]!.title = "edited";
  const after = buildVideoSavePayload(drafts);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[2], before[2]);
  assert.deepEqual((after[1]!.clips as Array<{ id: string }>).map((c) => c.id), ["b1", "b2"]);
  assert.notDeepEqual(after[1], before[1]);
});

test("12 editing one field keeps every other field and every clip", () => {
  const items = [stored("a", { description: "d", categoryId: "k", thumbnail: "/t.png", videoUrl: "/v.mp4", durationSeconds: 42, clips: [clip("a1", "https://x/1.mp4", { title: "t1" })] })];
  const drafts = toVideoDraftList(items);
  drafts[0]!.title = "New title";
  const [saved] = buildVideoSavePayload(drafts);
  assert.deepEqual({ ...saved, title: "Card a" }, { ...items[0], sortOrder: 0 });
});

test("an unedited draft round-trips to exactly what was stored (nothing lost, nothing added)", () => {
  const items = [stored("a", { videoUrl: "/a.mp4", clips: [clip("a1", "https://x/1.mp4")] }), stored("b")];
  assert.deepEqual(buildVideoSavePayload(toVideoDraftList(items)), items.map((i, idx) => ({ ...i, sortOrder: idx })));
});

test("8 deleting removes only the flagged card and all of its clips", () => {
  const drafts = toVideoDraftList([
    stored("a", { clips: [clip("a1", "https://x/a1.mp4")] }),
    stored("b", { clips: [clip("b1", "https://x/b1.mp4"), clip("b2", "https://x/b2.mp4")] }),
    stored("c"),
  ]);
  drafts[1]!.markedForDeletion = true;
  const payload = buildVideoSavePayload(drafts);
  assert.deepEqual(payload.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(payload.map((p) => p.sortOrder), [0, 1]);
  assert.equal(JSON.stringify(payload).includes("b1.mp4"), false);
  assert.equal(JSON.stringify(payload).includes("b2.mp4"), false);
});

test("10 cancelling a delete: the baseline never contains the flag, so Cancel restores the card", () => {
  const items = [stored("a"), stored("b")];
  const baseline = toVideoDraftList(items);
  assert.ok(baseline.every((d) => d.markedForDeletion === false));
  const edited: VideoCurationDraft[] = baseline.map((d) => (d.id === "b" ? { ...d, markedForDeletion: true } : d));
  assert.notEqual(JSON.stringify(edited), JSON.stringify(baseline)); // dirty
  assert.deepEqual(buildVideoSavePayload(baseline).map((p) => p.id), ["a", "b"]); // cancel => unchanged
});

test("stable ids: missing and duplicate ids are repaired deterministically (same input -> same output)", () => {
  const items = [stored("dup", { clips: [clip("k", "https://x/1.mp4"), clip("k", "https://x/2.mp4"), { externalUrl: "https://x/3.mp4" }] }), stored("dup"), { title: "no id" } as HomepageSectionItem];
  const first = toVideoDraftList(items);
  const second = toVideoDraftList(items);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((d) => d.id)).size, 3);
  assert.equal(new Set(first[0]!.clips.map((c) => c.id)).size, 3);
});

test("makeUniqueId keeps a good id and only renames a repeat", () => {
  const seen = new Set<string>();
  assert.equal(makeUniqueId("a", "f1", seen), "a");
  assert.equal(makeUniqueId("a", "f2", seen), "a-dup2");
  assert.equal(makeUniqueId(undefined, "f3", seen), "f3");
});

test("countPlayableVideos counts the main video (if any) plus clips with a source", () => {
  const [d] = toVideoDraftList([stored("a", { externalUrl: "https://x/m.mp4", clips: [clip("1", "https://x/1.mp4"), { id: "2" }] })]);
  assert.equal(countPlayableVideos(d!), 2);
});

console.log("playlist navigation (one player per card)");

const sixCards = () => [
  curation("ac", { videoUrl: "/m/ac-main.mp4", clips: [1, 2, 3, 4].map((n) => ({ id: `ac-${n}`, title: null, videoUrl: null, externalUrl: `https://v/ac/${n}.mp4`, thumbnail: null, durationSeconds: null })) }),
  curation("wm", { videoUrl: "/m/wm-main.mp4", clips: [1, 2].map((n) => ({ id: `wm-${n}`, title: null, videoUrl: null, externalUrl: `https://v/wm/${n}.mp4`, thumbnail: null, durationSeconds: null })) }),
  curation("chimney", { videoUrl: "/m/ch-main.mp4" }),
  curation("fridge"),
];

test("Next/Previous walk exactly one card's videos in the configured order and wrap inside that card", () => {
  const ac = buildPlaylist(sixCards()[0]!);
  assert.equal(ac.length, 5);
  const order: string[] = [];
  let id: string | null = ac[0]!.id;
  for (let i = 0; i < 5; i++) {
    order.push(id!);
    id = stepPlaylist(ac, id, 1);
  }
  assert.deepEqual(order, ["ac::main", "ac::clip::ac-1", "ac::clip::ac-2", "ac::clip::ac-3", "ac::clip::ac-4"]);
  assert.equal(id, "ac::main"); // wrapped back to its own first video
  assert.equal(stepPlaylist(ac, "ac::main", -1), "ac::clip::ac-4");
  assert.ok(order.every((e) => e.startsWith("ac::")));
});

test("stepping never leaves the card, whatever the starting id (even another card's)", () => {
  const [ac, wm] = sixCards().map(buildPlaylist);
  for (const start of [null, "wm::clip::wm-2", "nonsense"]) {
    const next = stepPlaylist(ac!, start, 1);
    assert.ok(next!.startsWith("ac::"), `${start} -> ${next}`);
  }
  assert.ok(stepPlaylist(wm!, "ac::clip::ac-3", -1)!.startsWith("wm::"));
});

test("empty and single-video playlists: nothing to step to (empty state / same video)", () => {
  const [, , chimney, fridge] = sixCards().map(buildPlaylist);
  assert.equal(stepPlaylist(fridge!, null, 1), null);
  assert.equal(stepPlaylist(chimney!, "chimney::main", 1), "chimney::main");
});

test("six cards: no entry id and no URL appears in two playlists", () => {
  const all = sixCards().flatMap(buildPlaylist);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length);
  const urls = all.map((e) => e.videoUrl ?? e.externalUrl);
  assert.equal(new Set(urls).size, urls.length);
});

test("a clip id repeated on two cards is repaired to a unique id in the editor (and so is stable on every render)", () => {
  const a = toVideoDraftList([stored("a", { clips: [clip("same", "https://x/a.mp4")] }), stored("b", { clips: [clip("same", "https://x/b.mp4")] })]);
  const ids = a.flatMap((c) => c.clips.map((x) => x.id));
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(toVideoDraftList([stored("a", { clips: [clip("same", "https://x/a.mp4")] }), stored("b", { clips: [clip("same", "https://x/b.mp4")] })]), a);
});

console.log("dirty registry (Maximum update depth)");

test("14 the tracker notifies only when the dirty set really changes", () => {
  const calls: string[][] = [];
  const t = createDirtyTracker((_any, labels) => calls.push(labels));
  t.setDirty("a", false, "A"); // never dirty -> no notification
  t.setDirty("a", false, "A");
  assert.equal(calls.length, 0);
  t.setDirty("a", true, "A");
  t.setDirty("a", true, "A"); // repeat -> ignored
  assert.equal(calls.length, 1);
  t.setDirty("b", true, "B");
  t.setDirty("a", false, "A");
  t.setDirty("a", false, "A"); // repeat -> ignored
  assert.deepEqual(calls, [["A"], ["A", "B"], ["B"]]);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
