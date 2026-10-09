// Renders the REAL Homepage Content admin panel (all its sections, each with
// its own useDraftSave, under the real DirtyRegistryProvider) in jsdom with a
// stubbed network, and fails on "Maximum update depth exceeded" / "Too many
// re-renders" or on an unbounded number of render commits. Then it clicks
// Active / Delete / Cancel / typing, which register and clear dirty state.
//
// Needs dev-only tools that are NOT added to package.json:
//   npm i --no-save jsdom tsx
//   npx tsx --tsconfig scripts/verify-video-showcase/tsconfig.test.json scripts/verify-video-showcase/admin-render-loop.test.ts
import assert from "node:assert/strict";
import * as React from "react";
import { createElement, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// jsdom is a dev-only tool that is deliberately NOT in package.json, so it is
// imported through a variable specifier: `next build` type-checks every file
// under tsconfig "include", and a static `import "jsdom"` would fail that
// check on a machine that hasn't installed it.
type JsdomCtor = new (html: string, opts: object) => { window: Window & typeof globalThis };
const jsdomSpecifier = "jsdom";
let dom!: { window: Window & typeof globalThis };

const g = globalThis as unknown as Record<string, unknown>;

async function setupDom() {
  const { JSDOM } = (await import(jsdomSpecifier)) as { JSDOM: JsdomCtor };
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost:3000/admin", pretendToBeVisual: true });
  for (const key of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
    try {
      g[key] = (dom.window as unknown as Record<string, unknown>)[key];
    } catch {
      Object.defineProperty(globalThis, key, { value: (dom.window as unknown as Record<string, unknown>)[key], configurable: true });
    }
  }
}

g.IS_REACT_ACT_ENVIRONMENT = true;
// tsx compiles the panel with the classic JSX transform here, which needs React in scope.
g.React = React;

const errors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(" "));
};

const cards = [
  { id: "vc-a", title: "Card A", sortOrder: 0, active: 1, videoUrl: "/a.mp4", clips: [{ id: "a1", externalUrl: "https://x.test/a1.mp4" }] },
  { id: "vc-b", title: "Card B", sortOrder: 1, active: 1, externalUrl: "https://x.test/b.mp4" },
  { id: "vc-c", title: "Card C", sortOrder: 2, active: 0 },
];
const section = (key: string, items: unknown) => ({ key, heading: key, subheading: null, body: null, ctaText: null, ctaLink: null, items, sortOrder: 0, image: null, imageAlt: null });
const sections = [
  section("hero", [{ id: "s0", slot: "0", url: "/h0.png", alt: "h" }]),
  section("whyChooseUs", [{ id: "t1", icon: "shield-check", title: "T", description: "D", active: 1 }]),
  section("howItWorks", [{ number: "1", title: "S", description: "D" }]),
  section("video-curations", cards),
];
const saves: Array<{ url: string; method: string }> = [];
g.fetch = async (url: string, init?: RequestInit) => {
  const u = String(url);
  const method = init?.method ?? "GET";
  if (method !== "GET") saves.push({ url: u, method });
  const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  if (u.endsWith("/admin/homepage-sections")) return ok(sections);
  return new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "stub" } }), { status: 404, headers: { "content-type": "application/json" } });
};

async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
}
const text = () => (dom.window.document.body.textContent ?? "").replace(/\s+/g, " ");
async function main() {
  await setupDom();
  const { AdminHomepageContentPanel } = await import("../../src/components/account/AdminHomepageContentPanel");
  let commits = 0;
  const root = createRoot(dom.window.document.getElementById("root")!);
  await act(async () => {
    root.render(createElement(Profiler, { id: "panel", onRender: () => { commits++; } }, createElement(AdminHomepageContentPanel, {})));
  });
  await settle();

  const loopErrors = () => errors.filter((e) => /Maximum update depth|Too many re-renders/i.test(e));
  const results: string[] = [];
  const check = (name: string, fn: () => void) => {
    try { fn(); results.push(`  ok   ${name}`); } catch (e) { results.push(`  FAIL ${name}\n       ${(e as Error).message}`); process.exitCode = 1; }
  };

  check("panel renders every section after load", () => {
    assert.ok(text().includes("Real service visits, on video (Video Showcase)"));
    assert.ok(text().includes("Trust / service benefit strip"));
  });
  check("idle render settles: no update-depth error and a bounded number of commits", () => {
    assert.equal(loopErrors().length, 0, loopErrors()[0]);
    assert.ok(commits < 60, `render commits after load: ${commits}`);
  });

  const doc = dom.window.document;
  const videoShell = [...doc.querySelectorAll("h2")].find((h) => h.textContent?.includes("Video Showcase"))!.closest("div.rounded-2xl") as HTMLElement;
  const before = commits;
  const activeBox = videoShell.querySelectorAll<HTMLInputElement>("input[type=checkbox]")[0]!;
  await act(async () => { activeBox.click(); });
  await settle();
  check("toggling Active marks only the video section dirty", () => {
    assert.ok(text().includes("Unsaved changes in: Real service visits, on video"), text().slice(0, 300));
    assert.ok(!/Unsaved changes in:[^.]*Trust/.test(text()));
    assert.equal(loopErrors().length, 0, loopErrors()[0]);
    assert.ok(commits - before < 40, `commits for one toggle: ${commits - before}`);
  });

  const cancelBtn = () => [...videoShell.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Cancel")!;
  await act(async () => { cancelBtn().click(); });
  await settle();
  check("Cancel clears the dirty state", () => {
    assert.ok(!text().includes("Unsaved changes in:"));
    assert.equal(videoShell.querySelectorAll<HTMLInputElement>("input[type=checkbox]")[0]!.checked, true);
  });

  const deleteBtn = [...videoShell.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete")!;
  await act(async () => { deleteBtn.click(); });
  await settle();
  check("Delete only flags the card (nothing is sent to the server) and Cancel restores it", () => {
    assert.ok(text().includes("Marked for deletion"));
    assert.equal(saves.length, 0);
  });
  await act(async () => { cancelBtn().click(); });
  await settle();
  check("after Cancel the card is back and nothing was saved", () => {
    assert.ok(!text().includes("Marked for deletion"));
    assert.ok(text().includes("Unsaved changes in:") === false);
    assert.equal(saves.length, 0);
  });

  const addCard = [...videoShell.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Add video card")!;
  for (let i = 0; i < 3; i++) await act(async () => { addCard.click(); });
  await settle();
  check("adding cards (new ids, new drafts) is dirty-tracked and never loops", () => {
    assert.equal(loopErrors().length, 0, loopErrors()[0]);
    assert.equal(videoShell.querySelectorAll("input[type=checkbox]").length, 6);
    assert.ok(text().includes("Unsaved changes in: Real service visits, on video"));
  });
  await act(async () => { cancelBtn().click(); });
  await settle();
  check("Cancel discards the added cards and clears the banner", () => {
    assert.equal(videoShell.querySelectorAll("input[type=checkbox]").length, 3);
    assert.ok(!text().includes("Unsaved changes in:"));
    assert.equal(saves.length, 0);
  });

  await act(async () => { root.unmount(); });
  console.error = origError;
  console.log(results.join("\n"));
  console.log(`\ntotal render commits: ${commits}; console.error calls: ${errors.length}`);
  if (errors.length && process.exitCode) console.log("first console.error:", errors[0]!.slice(0, 300));
  process.exit(process.exitCode ?? 0);
}
main().catch((e) => { console.error = origError; console.error(e); process.exit(1); });
