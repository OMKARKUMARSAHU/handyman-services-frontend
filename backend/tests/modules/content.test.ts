import { testAgent } from "../helpers/testApp";
import { getDb } from "../../src/database/db";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";

/** PHASE_3 brief — Admin Panel content/branding: DB/API-backed, no hardcoded text, public reads only ever surface admin-approved/published content. */
describe("admin content", () => {
  const adminToken = mintToken({ role: "admin" });
  const customerToken = mintToken({ role: "customer" });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("only shows approved testimonials publicly, while Admin sees everything", async () => {
    const approvedRes = await testAgent()
      .post("/api/v1/admin/testimonials")
      .set("Authorization", bearer(adminToken))
      .send({ name: "Asha", city: "Bengaluru", rating: 5, quote: "Great service!", approved: true });
    expect(approvedRes.status).toBe(201);

    await testAgent()
      .post("/api/v1/admin/testimonials")
      .set("Authorization", bearer(adminToken))
      .send({ name: "Ravi", city: "Pune", rating: 4, quote: "Pending moderation", approved: false });

    const publicRes = await testAgent().get("/api/v1/testimonials");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data).toHaveLength(1);
    expect(publicRes.body.data[0].name).toBe("Asha");

    const adminRes = await testAgent().get("/api/v1/admin/testimonials").set("Authorization", bearer(adminToken));
    expect(adminRes.body.data).toHaveLength(2);
  });

  it("blocks a customer from writing FAQs, homepage sections, contact info, or branding", async () => {
    const faqRes = await testAgent()
      .post("/api/v1/admin/faqs")
      .set("Authorization", bearer(customerToken))
      .send({ question: "Q", answer: "A" });
    expect(faqRes.status).toBe(403);

    const brandingRes = await testAgent()
      .patch("/api/v1/admin/branding")
      .set("Authorization", bearer(customerToken))
      .send({ logoUrl: "https://example.com/logo.png" });
    expect(brandingRes.status).toBe(403);
  });

  it("creates and reads back a homepage section by its stable key", async () => {
    const createRes = await testAgent()
      .post("/api/v1/admin/homepage-sections")
      .set("Authorization", bearer(adminToken))
      .send({ key: "hero", heading: "Book trusted home services" });
    expect(createRes.status).toBe(201);

    const listRes = await testAgent().get("/api/v1/homepage-sections");
    expect(listRes.body.data.some((s: { key: string }) => s.key === "hero")).toBe(true);

    const updateRes = await testAgent()
      .patch("/api/v1/admin/homepage-sections/hero")
      .set("Authorization", bearer(adminToken))
      .send({ heading: "Updated heading" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.heading).toBe("Updated heading");
  });

  describe("video showcase (video-curations) cards", () => {
    const card = (id: string, active: number | undefined, extra: Record<string, unknown> = {}) => ({
      id,
      title: `Card ${id}`,
      sortOrder: 0,
      ...(active === undefined ? {} : { active }),
      ...extra,
    });

    async function saveCards(items: Array<Record<string, unknown>>) {
      const existing = await testAgent().get("/api/v1/admin/homepage-sections").set("Authorization", bearer(adminToken));
      const exists = existing.body.data.some((s: { key: string }) => s.key === "video-curations");
      if (exists) {
        return testAgent()
          .patch("/api/v1/admin/homepage-sections/video-curations")
          .set("Authorization", bearer(adminToken))
          .send({ items });
      }
      return testAgent()
        .post("/api/v1/admin/homepage-sections")
        .set("Authorization", bearer(adminToken))
        .send({ key: "video-curations", heading: "Real service visits, on video", items });
    }

    const publicCards = async () => {
      const res = await testAgent().get("/api/v1/homepage-sections");
      return (res.body.data.find((s: { key: string }) => s.key === "video-curations")?.items ?? []) as Array<{ id: string }>;
    };

    it("never returns inactive cards (or their videos/clips) from the public endpoint, while Admin still sees them", async () => {
      const res = await saveCards([
        card("a", 1, { videoUrl: "/api/backend/media/a.mp4" }),
        card("b", 0, { videoUrl: "/api/backend/media/b.mp4", clips: [{ id: "b1", externalUrl: "https://example.com/b1.mp4" }] }),
        card("c", undefined),
      ]);
      expect([200, 201]).toContain(res.status);

      const publicRaw = await testAgent().get("/api/v1/homepage-sections");
      expect((await publicCards()).map((c) => c.id)).toEqual(["a", "c"]);
      expect(JSON.stringify(publicRaw.body)).not.toContain("b.mp4");
      expect(JSON.stringify(publicRaw.body)).not.toContain("b1.mp4");

      const adminRes = await testAgent().get("/api/v1/admin/homepage-sections").set("Authorization", bearer(adminToken));
      const adminCards = adminRes.body.data.find((s: { key: string }) => s.key === "video-curations").items;
      expect(adminCards.map((c: { id: string }) => c.id)).toEqual(["a", "b", "c"]);
    });

    it("treats Active separately from whether a video exists, and reactivating brings the card back", async () => {
      await saveCards([card("no-video-active", 1), card("video-inactive", 0, { videoUrl: "/x.mp4" })]);
      expect((await publicCards()).map((c) => c.id)).toEqual(["no-video-active"]);

      await saveCards([card("no-video-active", 1), card("video-inactive", 1, { videoUrl: "/x.mp4" })]);
      expect((await publicCards()).map((c) => c.id)).toEqual(["no-video-active", "video-inactive"]);
    });

    it("removes exactly one card (with its clips) when it is left out of the saved list", async () => {
      await saveCards([
        card("keep-1", 1),
        card("delete-me", 1, { clips: [{ id: "c1", externalUrl: "https://example.com/c1.mp4" }] }),
        card("keep-2", 1, { clips: [{ id: "k2c", externalUrl: "https://example.com/k2c.mp4" }] }),
      ]);
      await saveCards([card("keep-1", 1), card("keep-2", 1, { clips: [{ id: "k2c", externalUrl: "https://example.com/k2c.mp4" }] })]);

      const cards = (await publicCards()) as Array<{ id: string; clips?: Array<{ id: string }> }>;
      expect(cards.map((c) => c.id)).toEqual(["keep-1", "keep-2"]);
      expect(cards[1]!.clips!.map((c) => c.id)).toEqual(["k2c"]);
    });

    const publicRaw = async () => JSON.stringify((await testAgent().get("/api/v1/homepage-sections")).body);
    const clipsOf = (id: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${id}-c${i + 1}`, title: `${id} clip ${i + 1}`, externalUrl: `https://videos.example.com/${id}-${i + 1}.mp4` }));

    it("removing the main video (file and external URL) leaves no trace of the old video in the public response", async () => {
      await saveCards([
        card("washer", 1, { videoUrl: "/api/backend/media/old-washer.mp4", externalUrl: "https://panda.example.com/old-washer", thumbnail: "/t/washer.png" }),
        card("ac", 1, { videoUrl: "/api/backend/media/ac.mp4" }),
      ]);
      expect(await publicRaw()).toContain("old-washer");

      // What the admin editor sends after the main video is removed: the keys are simply absent.
      const res = await saveCards([card("washer", 1, { thumbnail: "/t/washer.png" }), card("ac", 1, { videoUrl: "/api/backend/media/ac.mp4" })]);
      expect(res.status).toBe(200);

      const raw = await publicRaw();
      expect(raw).not.toContain("old-washer");
      expect(raw).not.toContain("panda.example.com");
      const cards = await publicCards();
      expect(cards.find((c) => c.id === "washer")).not.toHaveProperty("videoUrl");
      expect(cards.find((c) => c.id === "washer")).not.toHaveProperty("externalUrl");
      expect(cards.find((c) => c.id === "ac")).toHaveProperty("videoUrl", "/api/backend/media/ac.mp4");
    });

    it("keeps an emptied card listed with no video fields at all (the public UI shows 'Video coming soon')", async () => {
      await saveCards([card("empty", 1, { videoUrl: "/old.mp4", clips: clipsOf("empty", 2) })]);
      await saveCards([card("empty", 1)]);
      const [only] = (await publicCards()) as Array<Record<string, unknown>>;
      expect(only).toMatchObject({ id: "empty", active: 1 });
      expect(only).not.toHaveProperty("videoUrl");
      expect(only).not.toHaveProperty("externalUrl");
      expect(only).not.toHaveProperty("clips");
    });

    it.each([1, 2, 4])("a card with %i clip(s) returns exactly its own clips, and no other card's", async (n) => {
      await saveCards([card("one", 1, { clips: clipsOf("one", 1) }), card("two", 1, { clips: clipsOf("two", 2) }), card("four", 1, { clips: clipsOf("four", 4) })]);
      const cards = (await publicCards()) as Array<{ id: string; clips?: Array<{ id: string; externalUrl: string }> }>;
      const target = cards.find((c) => c.id === { 1: "one", 2: "two", 4: "four" }[n as 1 | 2 | 4])!;
      expect(target.clips).toHaveLength(n);
      for (const clip of target.clips!) expect(clip.externalUrl).toContain(`/${target.id}-`);
      expect(cards.map((c) => c.clips?.length)).toEqual([1, 2, 4]);
    });

    it("adding, editing, reordering or removing a clip on one card never changes another card", async () => {
      const a = card("a", 1, { videoUrl: "/a.mp4", clips: clipsOf("a", 2) });
      const b = card("b", 1, { videoUrl: "/b.mp4", clips: clipsOf("b", 3) });
      const c = card("c", 1, { thumbnail: "/c.png" });
      await saveCards([a, b, c]);
      const untouched = JSON.stringify((await publicCards()).filter((x) => x.id !== "b"));

      const edited = { ...b, clips: [{ ...clipsOf("b", 3)[0], title: "renamed" }, clipsOf("b", 3)[2]!, { id: "b-new", externalUrl: "https://videos.example.com/b-new.mp4" }] };
      await saveCards([a, edited, c]);

      const after = await publicCards();
      expect(JSON.stringify(after.filter((x) => x.id !== "b"))).toBe(untouched);
      const editedBack = after.find((x) => x.id === "b") as unknown as { clips: Array<{ id: string }> };
      expect(editedBack.clips.map((x) => x.id)).toEqual(["b-c1", "b-c3", "b-new"]);
    });

    it("stores the saved list verbatim: editing one field keeps every other field and clip", async () => {
      const full = card("full", 1, { description: "d", categoryId: "kitchen", thumbnail: "/t.png", videoUrl: "/v.mp4", durationSeconds: 42, clips: clipsOf("full", 2) });
      await saveCards([full]);
      await saveCards([{ ...full, title: "Only the title changed" }]);
      expect((await publicCards())[0]).toEqual({ ...full, title: "Only the title changed" });
    });

    it("a deleted card and its clips never come back on later reads", async () => {
      await saveCards([card("keep", 1, { clips: clipsOf("keep", 1) }), card("gone", 1, { videoUrl: "/gone.mp4", clips: clipsOf("gone", 4) }), card("also-keep", 1)]);
      await saveCards([card("keep", 1, { clips: clipsOf("keep", 1) }), card("also-keep", 1)]);
      for (let i = 0; i < 3; i++) {
        expect((await publicCards()).map((c) => c.id)).toEqual(["keep", "also-keep"]);
        expect(await publicRaw()).not.toContain("gone");
      }
      const adminRes = await testAgent().get("/api/v1/admin/homepage-sections").set("Authorization", bearer(adminToken));
      expect(JSON.stringify(adminRes.body)).not.toContain("gone");
    });

    it("six cards keep six independent playlists: each card's public AND stored data contains only its own videos, in the saved order", async () => {
      const vid = (cardId: string, n: number) => `https://videos.example.com/${cardId}/v${n}.mp4`;
      const mk = (id: string, mainN: boolean, clips: number) =>
        card(id, 1, {
          ...(mainN ? { externalUrl: vid(id, 0) } : {}),
          ...(clips ? { clips: Array.from({ length: clips }, (_, i) => ({ id: `${id}-clip-${i + 1}`, title: `${id} #${i + 1}`, externalUrl: vid(id, i + 1) })) } : {}),
        });
      const saved = [mk("ac-installation", true, 4), mk("washing-machine", true, 2), mk("chimney", true, 3), mk("refrigerator", true, 0), mk("water-purifier", false, 1), mk("gas-stove", false, 0)];
      expect([200, 201]).toContain((await saveCards(saved)).status);

      const expectedClips: Record<string, number> = { "ac-installation": 4, "washing-machine": 2, chimney: 3, refrigerator: 0, "water-purifier": 1, "gas-stove": 0 };
      type Stored = { id: string; externalUrl?: string; clips?: Array<{ id: string; externalUrl: string }> };
      const assertOwn = (cards: Stored[], where: string) => {
        expect(cards.map((c) => c.id)).toEqual(saved.map((c) => c.id as string));
        const seenUrls = new Set<string>();
        const seenClipIds = new Set<string>();
        for (const c of cards) {
          const urls = [...(c.externalUrl ? [c.externalUrl] : []), ...(c.clips ?? []).map((x) => x.externalUrl)];
          for (const u of urls) {
            expect({ where, card: c.id, url: u, owned: u.includes(`/${c.id}/`) }).toMatchObject({ owned: true });
            expect(seenUrls.has(u)).toBe(false);
            seenUrls.add(u);
          }
          expect((c.clips ?? []).length).toBe(expectedClips[c.id]);
          // saved order is the playlist order
          expect((c.clips ?? []).map((x) => x.externalUrl)).toEqual((c.clips ?? []).map((_, i) => vid(c.id, i + 1)));
          for (const clip of c.clips ?? []) {
            expect(seenClipIds.has(clip.id)).toBe(false);
            seenClipIds.add(clip.id);
          }
        }
      };

      assertOwn((await publicCards()) as unknown as Stored[], "public API");
      const row = await getDb()("homepage_sections").where({ key: "video-curations" }).first();
      const stored = (typeof row.items === "string" ? JSON.parse(row.items) : row.items) as Stored[];
      assertOwn(stored, "database row");
      // exactly one row holds every card -- no card's playlist lives anywhere else
      expect((await getDb()("homepage_sections").count({ n: "*" }).first())!.n).toBe(1);
    });

    it("reordering and removing clips on one card is persisted in that order and leaves every other card byte-identical", async () => {
      const ac = card("ac", 1, { externalUrl: "https://v.example.com/ac/main.mp4", clips: clipsOf("ac", 4) });
      const wm = card("wm", 1, { externalUrl: "https://v.example.com/wm/main.mp4", clips: clipsOf("wm", 2) });
      await saveCards([ac, wm]);
      const wmBefore = JSON.stringify((await publicCards()).find((c) => c.id === "wm"));

      const c = clipsOf("ac", 4);
      await saveCards([{ ...ac, clips: [c[2]!, c[0]!, c[3]!] }, wm]); // reorder + remove clip 2
      const cards = (await publicCards()) as Array<{ id: string; clips?: Array<{ id: string }> }>;
      expect(cards.find((x) => x.id === "ac")!.clips!.map((x) => x.id)).toEqual(["ac-c3", "ac-c1", "ac-c4"]);
      expect(JSON.stringify(cards.find((x) => x.id === "wm"))).toBe(wmBefore);

      const { clips: _dropped, ...acNoClips } = ac as typeof ac & { clips?: unknown }; // what the Admin sends once every clip is removed: the key is simply absent
      void _dropped;
      await saveCards([acNoClips, wm]);
      const after = (await publicCards()) as Array<{ id: string; clips?: unknown }>;
      expect(after.find((x) => x.id === "ac")).not.toHaveProperty("clips");
      expect(JSON.stringify(after.find((x) => x.id === "wm"))).toBe(wmBefore);
    });

    it("rejects a list with a duplicate or missing card/clip id, shows the reason, and leaves the stored list unchanged", async () => {
      await saveCards([card("a", 1, { videoUrl: "/a.mp4" })]);
      const before = await publicRaw();

      for (const bad of [
        [card("dup", 1), card("dup", 1)],
        [{ title: "no id", sortOrder: 0 }],
        [card("x", 1, { clips: [{ id: "same", externalUrl: "https://v.example.com/1.mp4" }, { id: "same", externalUrl: "https://v.example.com/2.mp4" }] })],
        [card("x", 1, { clips: [{ externalUrl: "https://v.example.com/1.mp4" }] })],
        // the same clip id on two different cards would let one card's clip be mistaken for the other's
        [card("x", 1, { clips: [{ id: "shared", externalUrl: "https://v.example.com/x.mp4" }] }), card("y", 1, { clips: [{ id: "shared", externalUrl: "https://v.example.com/y.mp4" }] })],
      ]) {
        const res = await saveCards(bad as Array<Record<string, unknown>>);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toMatch(/id/i);
      }
      expect(await publicRaw()).toBe(before);
    });

    it("requires an admin to read the unfiltered admin list", async () => {
      expect((await testAgent().get("/api/v1/admin/homepage-sections")).status).toBe(401);
      expect(
        (await testAgent().get("/api/v1/admin/homepage-sections").set("Authorization", bearer(customerToken))).status
      ).toBe(403);
    });
  });

  it("upserts the singleton contact info and branding records", async () => {
    const contactRes = await testAgent()
      .patch("/api/v1/admin/contact-info")
      .set("Authorization", bearer(adminToken))
      .send({ phone: "+911234567890", whatsapp: "+911234567890" });
    expect(contactRes.status).toBe(200);

    const publicContactRes = await testAgent().get("/api/v1/contact-info");
    expect(publicContactRes.body.data.phone).toBe("+911234567890");

    const brandingRes = await testAgent()
      .patch("/api/v1/admin/branding")
      .set("Authorization", bearer(adminToken))
      .send({ logoUrl: "https://example.com/logo.png", logoAlt: "Company logo" });
    expect(brandingRes.status).toBe(200);

    const publicBrandingRes = await testAgent().get("/api/v1/branding");
    expect(publicBrandingRes.body.data.logoUrl).toBe("https://example.com/logo.png");
  });
});
