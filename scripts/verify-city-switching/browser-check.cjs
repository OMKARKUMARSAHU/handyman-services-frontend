// End-to-end browser check of the city-switching workflow (Patna -> Ranchi -> Patna -> ...).
// It drives the real site in Chromium against a running frontend + backend whose database has these test facts:
//   - Ranchi: product "washing-machine-demo" is NOT available; service "hob-service" has a Ranchi price of 299
//   - Patna : product "refrigerator-demo" has a city price of 24000
//   - Delhi : product "refrigerator-demo" is NOT available
// Run: NODE_PATH=<dir containing playwright> node scripts/verify-city-switching/browser-check.cjs
// Env: BASE (default http://localhost:3000), CHROMIUM (default /opt/pw-browsers/chromium)
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       got: ${JSON.stringify(detail)}` : ""}`);
  }
}

async function productsBlock(p) {
  return p.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Products");
    if (!h) return { present: false };
    const box = h.parentElement;
    const tiles = [...box.querySelectorAll('article')].map((a) => ({
      name: a.querySelector("a")?.getAttribute("aria-label")?.replace(/^View /, "") || "",
      price: (a.querySelector("span.font-bold")?.textContent || "").replace(/[^\d]/g, ""),
    }));
    return {
      present: true,
      tiles,
      loading: !!box.querySelector('[aria-busy="true"]'),
      alert: box.querySelector('[role="alert"]')?.textContent?.trim() || null,
      empty: [...box.querySelectorAll("p")].map((x) => x.textContent).find((t) => /No products are available/.test(t)) || null,
      allProducts: [...box.querySelectorAll("a")].some((a) => a.textContent.includes("All Products")),
    };
  });
}
const names = (b) => b.tiles.map((t) => t.name.toLowerCase());
const priceOf = (b, part) => b.tiles.find((t) => t.name.toLowerCase().includes(part))?.price;

async function settled(p, ms = 3500) {
  await p.waitForFunction(() => !document.querySelector('h2 ~ [aria-busy="true"], [aria-label^="Loading products"]'), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(ms);
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on("pageerror", (e) => pageErrors.push(e.message));
  await p.addInitScript(() => {
    try {
      if (!localStorage.getItem("handyman:selectedCitySlug")) localStorage.setItem("handyman:selectedCitySlug", "patna");
    } catch {}
  });

  const pick = async (name) => {
    await p.locator('header button[aria-label^="Location"], header button[aria-label="Select your city"]').first().click();
    await p.getByRole("dialog").getByRole("button", { name: new RegExp("^Select " + name + ",", "i") }).first().click();
    await p.waitForURL(new RegExp("/" + name.toLowerCase() + "$"), { timeout: 15000 });
  };
  // Price tokens (e.g. "₹299") shown on EVERY card for this service on the page (image link and text link both sit inside the card).
  const servicePrice = async (slug) =>
    p.evaluate((s) => {
      const tokens = new Set();
      for (const a of document.querySelectorAll(`a[href$="/service/${s}"]`)) {
        const card = a.parentElement;
        for (const t of card.textContent.match(/₹\s?[\d,]+/g) || []) tokens.add(t.replace(/\s/g, ""));
      }
      return [...tokens];
    }, slug);

  console.log("Scenario 1: homepage with Patna selected");
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p);
  let blk = await productsBlock(p);
  check("Products block present on /", blk.present);
  check("Patna: 3 products incl. washing machine", blk.tiles.length === 3 && names(blk).some((n) => n.includes("washing")), names(blk));
  check("Patna: refrigerator shows the Patna city price (24000)", priceOf(blk, "refrigerator") === "24000", blk.tiles);
  check("'All Products' tile present", blk.allProducts);
  check("header Products link present", await p.locator('header a[href="/products"]').count() > 0);
  const homeRails = await p.evaluate(() => [...document.querySelectorAll("h2")].some((h) => /services in Patna/.test(h.textContent)));
  check("service rails for Patna rendered on /", homeRails);

  console.log("Scenario 2: Patna -> Ranchi");
  await pick("Ranchi");
  await settled(p);
  blk = await productsBlock(p);
  check("URL is /ranchi", new URL(p.url()).pathname === "/ranchi", p.url());
  check("Products block STILL present on /ranchi (was the bug)", blk.present);
  check("Ranchi: washing machine (unavailable there) excluded, others kept", blk.tiles.length === 2 && !names(blk).some((n) => n.includes("washing")), names(blk));
  check("Ranchi: refrigerator is at its BASE price (27990), not Patna's", priceOf(blk, "refrigerator") === "27990", blk.tiles);
  check("'All Products' tile present", blk.allProducts);
  check("hob-service shows Ranchi price ₹299", (await servicePrice("hob-service")).includes("₹299"), await servicePrice("hob-service"));
  check("Ranchi hero + service category grid still render", (await p.locator("h1").innerText()).includes("Ranchi") && (await p.getByText("What do you need serviced?").count()) > 0);

  console.log("Scenario 3: Ranchi -> Patna");
  await pick("Patna");
  await settled(p);
  blk = await productsBlock(p);
  check("URL is /patna", new URL(p.url()).pathname === "/patna");
  check("Products block present again with the original 3 Patna products", blk.present && blk.tiles.length === 3, names(blk));
  check("Patna refrigerator price 24000 restored", priceOf(blk, "refrigerator") === "24000", blk.tiles);
  const hobPatna = await servicePrice("hob-service");
  check("hob-service back to the BASE price (no Ranchi ₹299)", hobPatna.length > 0 && !hobPatna.includes("₹299") && hobPatna.includes("₹350"), hobPatna);

  console.log("Scenario 4/5: Patna -> Ranchi -> Patna -> Delhi -> Ranchi");
  const seen = [];
  for (const c of ["Ranchi", "Patna", "Delhi", "Ranchi"]) {
    await pick(c);
    await settled(p, 2500);
    seen.push([c, await productsBlock(p)]);
  }
  check("repeated switching: Products block present every time", seen.every(([, x]) => x.present && x.allProducts), seen.map(([c, x]) => [c, x.present]));
  check("Ranchi (1st): no washing machine", !names(seen[0][1]).some((n) => n.includes("washing")));
  check("Patna: washing machine + refrigerator 24000", names(seen[1][1]).some((n) => n.includes("washing")) && priceOf(seen[1][1], "refrigerator") === "24000");
  check("Delhi: refrigerator excluded but the section still shows the other products", !names(seen[2][1]).some((n) => n.includes("refrigerator")) && seen[2][1].tiles.length >= 1, names(seen[2][1]));
  check("Ranchi (2nd): identical to the 1st Ranchi visit", JSON.stringify(seen[3][1].tiles) === JSON.stringify(seen[0][1].tiles));

  console.log("Scenario: city-agnostic '/' follows the stored city (reload with Ranchi stored)");
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p, 4000);
  blk = await productsBlock(p);
  check("/ with Ranchi stored: shows Ranchi's products (no washing machine)", blk.present && blk.tiles.length === 2 && !names(blk).some((n) => n.includes("washing")), names(blk));
  const hobHome = await servicePrice("hob-service");
  check("/ rails show the Ranchi price for hob-service (₹299)", hobHome.includes("₹299") && !hobHome.includes("₹350"), hobHome);

  console.log("Scenario: /products listing follows the city, switching without navigation");
  await p.goto(BASE + "/products", { waitUntil: "load" });
  await settled(p, 3000);
  const listNames = async () => (await p.locator("article a[aria-label^='View ']").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label").replace(/^View /, "").toLowerCase())));
  let list = await listNames();
  check("/products for Ranchi: washing machine absent", list.length > 0 && !list.some((n) => n.includes("washing machine")), list);
  await p.getByRole("button", { name: "Change city", exact: true }).click();
  await p.getByRole("dialog").getByRole("button", { name: /^Select Patna,/ }).first().click();
  await settled(p, 3000);
  check("stayed on /products after changing city", new URL(p.url()).pathname === "/products");
  list = await listNames();
  check("/products for Patna: washing machine present", list.some((n) => n.includes("washing machine")), list);

  console.log("Scenario 10: API failures and empty responses");
  // 10a: server error on the shop API => error + retry, never "no products"
  await p.route("**/api/backend/shop/products**", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "X", message: "x" } }) }));
  await p.evaluate(() => localStorage.setItem("handyman:selectedCitySlug", "delhi"));
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p, 3000);
  blk = await productsBlock(p);
  check("500: error with Try again shown (not 'no products', not stale base items)", blk.present && !!blk.alert && /Try again/.test(blk.alert) && !blk.empty && blk.tiles.length === 0, blk);
  check("500: 'All Products' still reachable", blk.allProducts);
  await p.unroute("**/api/backend/shop/products**");
  await p.getByRole("button", { name: "Try again" }).first().click();
  await settled(p, 2500);
  blk = await productsBlock(p);
  check("Try again recovers and shows Delhi's products", blk.tiles.length > 0 && !blk.alert && !names(blk).some((n) => n.includes("refrigerator")), blk);

  // 10b: one 429 then success => automatic retry, no error shown
  let hits = 0;
  await p.route("**/api/backend/shop/products**", (r) => {
    hits++;
    if (hits === 1) return r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ success: false, error: { code: "RATE_LIMITED", message: "slow" } }) });
    return r.continue();
  });
  await p.evaluate(() => localStorage.setItem("handyman:selectedCitySlug", "patna"));
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p, 5000);
  blk = await productsBlock(p);
  check("single 429 is retried automatically and the list loads", hits >= 2 && blk.tiles.length === 3 && !blk.alert, { hits, blk });
  await p.unroute("**/api/backend/shop/products**");

  // 10c: empty successful response => the empty message (distinct from an error)
  await p.route("**/api/backend/shop/products**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [], meta: { page: 1, pageSize: 3, total: 0, totalPages: 1 } }) }));
  await p.evaluate(() => localStorage.setItem("handyman:selectedCitySlug", "mumbai"));
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p, 3000);
  blk = await productsBlock(p);
  check("empty success: 'No products are available…' message, section + 'All Products' stay", blk.present && !!blk.empty && !blk.alert && blk.allProducts, blk);
  await p.unroute("**/api/backend/shop/products**");

  // 10d: rails route failing => error + retry, no mock services
  await p.route("**/api/home-rails**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "RAILS_UNAVAILABLE", message: "x" } }) }));
  await p.evaluate(() => localStorage.setItem("handyman:selectedCitySlug", "kolkata"));
  await p.goto(BASE + "/", { waitUntil: "load" });
  await settled(p, 3000);
  const railsAlert = await p.locator('section [role="alert"]').first().innerText().catch(() => "");
  check("rails 503: error + Try again shown, no mock rails", /couldn't load services for Kolkata/i.test(railsAlert) && /Try again/.test(railsAlert), railsAlert);
  await p.unroute("**/api/home-rails**");
  await p.getByRole("button", { name: "Try again" }).last().click();
  await settled(p, 3000);
  check("rails Try again recovers", await p.evaluate(() => [...document.querySelectorAll("h2")].some((h) => /services in Kolkata/.test(h.textContent))));

  console.log("Scenario: in-flight response for an earlier city cannot overwrite the current city");
  await p.evaluate(() => localStorage.setItem("handyman:selectedCitySlug", "ranchi"));
  await p.route("**/api/backend/shop/products**", async (r) => {
    if (r.request().url().includes("city=patna")) await new Promise((res) => setTimeout(res, 2500)); // Patna answers LATE
    return r.continue();
  });
  await p.goto(BASE + "/products", { waitUntil: "load" });
  await settled(p, 2500);
  await p.getByRole("button", { name: "Change city", exact: true }).click();
  await p.getByRole("dialog").getByRole("button", { name: /^Select Patna,/ }).first().click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: "Change city", exact: true }).click();
  await p.getByRole("dialog").getByRole("button", { name: /^Select Ranchi,/ }).first().click(); // back to Ranchi while Patna is still in flight
  await p.waitForTimeout(5000);
  list = await listNames();
  check("after Patna (slow) -> Ranchi, the page shows RANCHI's list", list.length > 0 && !list.some((n) => n.includes("washing machine")), list);
  await p.unroute("**/api/backend/shop/products**");

  check("no uncaught page errors during the run", pageErrors.length === 0, pageErrors);
  await b.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(1);
  }
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(2);
});
