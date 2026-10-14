/*
 * Rendered-UI scan for leftover "demo" wording. Sandbox/dev helper (needs a running frontend on :3000, the dev
 * backend on :4000 and tokens.json from the test harness) — it is NOT part of the production build.
 *
 * Visits the public pages, the customer cart/checkout/orders pages and every Admin tab, then reports every place where
 * the rendered text OR an attribute (alt, title, aria-label, placeholder, href, src, input value) contains "demo".
 *
 * Usage: node scripts/verify-demo-cleanup/ui-scan.cjs [tokens.json path]
 * Env:   WEB=http://localhost:3000   PW=<playwright module path>   CHROMIUM=/path/to/chromium
 */
const path = require("path");
const PW = process.env.PW || "/home/claude/.npm-global/lib/node_modules/playwright";
const { chromium } = require(PW);
const tokens = require(path.resolve(process.argv[2] || "/tmp/claude-0/pw/tokens.json"));
const WEB = process.env.WEB || "http://localhost:3000";

const hits = [];
let pagesScanned = 0;

async function scan(page, label) {
  pagesScanned++;
  const found = await page.evaluate(() => {
    const out = [];
    const re = /demo/i;
    const add = (kind, where, value) => out.push({ kind, where, value: String(value).replace(/\s+/g, " ").slice(0, 140) });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue || "";
      if (re.test(t)) {
        const el = n.parentElement;
        if (el && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
        add("text", el ? el.tagName.toLowerCase() : "?", t);
      }
    }
    for (const el of document.querySelectorAll("*")) {
      for (const a of ["alt", "title", "aria-label", "placeholder", "href", "src", "value", "data-name"]) {
        const v = el.getAttribute(a);
        if (v && re.test(v)) add("attr:" + a, el.tagName.toLowerCase(), v);
      }
      if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && re.test(el.value || "")) add("field-value", el.tagName.toLowerCase(), el.value);
    }
    if (re.test(document.title)) add("title", "document", document.title);
    return out;
  });
  for (const f of found) hits.push({ page: label, ...f });
  console.log(`scanned ${label}: ${found.length} match(es)`);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const errs = [];
  const mk = async (token) => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    if (token) await ctx.addCookies([{ name: "hs_at", value: token, domain: "localhost", path: "/" }]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("dialog", (d) => d.dismiss());
    return { ctx, p };
  };
  const go = async (p, url) => {
    await p.goto(WEB + url, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
  };

  // ---- public (anonymous)
  {
    const { ctx, p } = await mk(null);
    for (const u of ["/", "/patna", "/ranchi", "/products", "/products?category=water-purifiers", "/products/refrigerator-demo", "/products/ro-membrane-demo", "/shop/cart"]) {
      await go(p, u);
      await scan(p, "public " + u);
    }
    await ctx.close();
  }

  // ---- customer: add to cart -> cart -> checkout -> orders
  {
    const { ctx, p } = await mk(tokens.customer);
    await go(p, "/products/washing-machine-demo");
    const add = p.getByRole("button", { name: /add to cart/i }).first();
    if (await add.count()) await add.click().catch(() => {});
    await p.waitForTimeout(800);
    await scan(p, "customer product detail after add-to-cart");
    await go(p, "/shop/cart");
    await scan(p, "customer /shop/cart");
    await go(p, "/shop/checkout");
    await scan(p, "customer /shop/checkout");
    await go(p, "/shop/orders");
    await scan(p, "customer /shop/orders");
    const first = p.locator('a[href^="/shop/orders/"]').first();
    if (await first.count()) {
      await first.click();
      await p.waitForTimeout(1500);
      await scan(p, "customer order detail");
    }
    await ctx.close();
  }

  // ---- admin
  {
    const { ctx, p } = await mk(tokens.admin);
    await go(p, "/admin");
    const tab = async (name) => {
      await p.getByRole("button", { name, exact: true }).first().click();
      await p.waitForTimeout(1500);
    };
    for (const t of ["Overview", "Provider Approvals", "Customers", "Orders", "Media", "Blog", "Services", "Homepage Content"]) {
      await tab(t).catch((e) => console.log("could not open tab", t, e.message.split("\n")[0]));
      await scan(p, "admin " + t);
    }
    await tab("Shop");
    await scan(p, "admin Shop > Products");
    // product edit form (first row)
    const edit = p.getByRole("button", { name: /^edit$/i }).first();
    if (await edit.count()) {
      await edit.click();
      await p.waitForTimeout(1500);
      await scan(p, "admin Shop > Products > edit form");
      await p.getByRole("button", { name: /back to products/i }).click().catch(() => {});
      await p.waitForTimeout(500);
    }
    for (const [name, label] of [["Categories", "Shop > Categories"], ["Shop orders", "Shop > Shop orders"], ["Settings", "Shop > Settings"]]) {
      await p.getByRole("tab", { name, exact: true }).click();
      await p.waitForTimeout(1500);
      await scan(p, "admin " + label);
    }
    // order detail inside "Shop orders"
    await p.getByRole("tab", { name: "Shop orders", exact: true }).click();
    await p.waitForTimeout(1200);
    const view = p.locator("tbody tr").first();
    if (await view.count()) {
      await view.click().catch(() => {});
      await p.waitForTimeout(1500);
      await scan(p, "admin Shop > Shop orders > first order");
    }
    await ctx.close();
  }

  await browser.close();
  console.log("\n=== pages scanned:", pagesScanned, "| page errors:", errs.length, errs.slice(0, 3));
  const byKind = {};
  for (const h of hits) (byKind[h.kind] = byKind[h.kind] || []).push(h);
  for (const [k, list] of Object.entries(byKind)) {
    console.log(`\n--- ${k} (${list.length})`);
    const seen = new Set();
    for (const h of list) {
      const key = h.page + "|" + h.value;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  [${h.page}] <${h.where}> ${h.value}`);
    }
  }
  console.log("\nTOTAL matches:", hits.length);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
