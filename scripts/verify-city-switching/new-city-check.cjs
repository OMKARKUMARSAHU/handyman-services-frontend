// Verifies a city created in the Admin panel (no code change) works across the site.
// Prerequisite test data (created through the real Admin APIs): city "gaya" (active); service "hob-service" available in it with a
// Gaya price of 277; product "refrigerator-demo" available in it with a Gaya price of 25555; nothing else configured for Gaya.
// Run: NODE_PATH=<dir containing playwright> node scripts/verify-city-switching/new-city-check.cjs
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";
let passed = 0; const failures = [];
const check = (n, c, d) => { if (c) { passed++; console.log(`  ok   ${n}`); } else { failures.push(n); console.log(`  FAIL ${n}${d !== undefined ? `\n       got: ${JSON.stringify(d)}` : ""}`); } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => { try { if (!localStorage.getItem("handyman:selectedCitySlug")) localStorage.setItem("handyman:selectedCitySlug", "patna"); } catch {} });
  await p.goto(BASE + "/", { waitUntil: "load" });
  await p.waitForTimeout(2500);

  await p.locator('header button[aria-label^="Location"]').first().click();
  const gayaBtn = p.getByRole("dialog").getByRole("button", { name: /^Select Gaya,/ });
  check("Admin-created city 'Gaya' is listed in the city selector", (await gayaBtn.count()) > 0);
  await gayaBtn.first().click();
  await p.waitForURL(/\/gaya$/, { timeout: 15000 });
  await p.waitForTimeout(3000);
  check("/gaya renders (not a 404)", (await p.locator("h1").innerText()).includes("Gaya"));
  check("header shows the new city", (await p.locator('header button[aria-label^="Location"]').first().getAttribute("aria-label")).includes("Gaya"));

  const tiles = await p.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Products");
    return h ? [...h.parentElement.querySelectorAll("article")].map((a) => ({ n: (a.querySelector("a")?.getAttribute("aria-label") || "").replace(/^View /, ""), p: (a.querySelector("span.font-bold")?.textContent || "").replace(/[^\d]/g, "") })) : null;
  });
  check("Products block present on /gaya", !!tiles, tiles);
  check("refrigerator shows the Gaya city price 25555", tiles?.find((t) => /refrigerator/i.test(t.n))?.p === "25555", tiles);
  check("products without a Gaya rule are available at base price (no rule = available)", tiles?.length === 3, tiles);

  const svcs = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/gaya/service/"]')].map((a) => a.getAttribute("href")))]);
  check("only the one service made available in Gaya is listed", svcs.length === 1 && svcs[0] === "/gaya/service/hob-service", svcs);
  const prices = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href$="/gaya/service/hob-service"]')].flatMap((a) => (a.parentElement.textContent.match(/₹\s?[\d,]+/g) || []).map((t) => t.replace(/\s/g, ""))))]);
  check("service card shows the Gaya price ₹277", prices.includes("₹277") && !prices.includes("₹350"), prices);

  await p.goto(BASE + "/gaya/service/hob-service", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  check("service detail page works for the new city and shows ₹277", (await p.locator("body").innerText()).includes("₹277"));
  const notAvail = await p.goto(BASE + "/gaya/service/hob-repair", { waitUntil: "load" });
  check("a service NOT made available in Gaya is not shown there (404)", notAvail.status() === 404, notAvail.status());

  await p.goto(BASE + "/products", { waitUntil: "load" });
  await p.waitForTimeout(3500);
  const listing = await p.locator("article").evaluateAll((els) => els.map((e) => ({ n: e.querySelector("a[aria-label^='View ']")?.getAttribute("aria-label") || "", t: e.textContent.replace(/[^\d₹,]/g, "") })));
  check("/products lists products with Gaya's price for the refrigerator", listing.some((x) => /refrigerator/i.test(x.n) && x.t.includes("25,555")), listing.slice(0, 4));

  await p.goto(BASE + "/products/refrigerator-demo", { waitUntil: "load" });
  await p.waitForTimeout(3500);
  check("product detail shows the Gaya price", (await p.locator("body").innerText()).includes("25,555"));
  await p.getByRole("button", { name: /add to cart/i }).first().click();
  await p.waitForTimeout(1500);
  await p.goto(BASE + "/shop/cart", { waitUntil: "load" });
  await p.waitForTimeout(3500);
  const cartText = await p.locator("body").innerText();
  check("shop cart is priced by the server at the Gaya price", cartText.includes("25,555"), cartText.slice(0, 300));
  check("no uncaught page errors", errs.length === 0, errs);
  await b.close();
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => { console.error("ERR", e.message); process.exit(2); });
