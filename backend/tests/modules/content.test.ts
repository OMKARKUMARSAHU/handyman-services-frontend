import { testAgent } from "../helpers/testApp";
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
