// Generates clean, professional, text-free SVG illustrations for the
// service image gallery — replacing the earlier placeholder SVGs that
// visibly baked in the words "Service photo placeholder N" (a client-
// flagged defect). One illustration per product (icon-themed, matching the
// existing icon set in src/lib/icons.tsx) plus 3 generic "service context"
// illustrations (tools / verified technician / trust) reused across every
// service's gallery as supporting images. No stock photography, no
// Urban Company assets — original, generated graphics only, consistent
// with the mock-data-only scope of this phase.
//
// Phase 3 "major homepage visual rework" pass (item 12/22): the previous
// version gave every product its own bold, saturated gradient (blue, red,
// purple, orange...) — exactly the "too colorful, large saturated
// background" look the client flagged on service cards. Regenerated with a
// single, restrained visual treatment shared by every product: a soft
// near-white/neutral background and one brand-teal icon circle, so a rail
// of service cards reads as a calm, consistent marketplace catalog instead
// of a rainbow of clashing tiles. Brand green is now used only as the small
// accent (icon + ring), not as the dominant fill.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AirVent,
  WashingMachine,
  Refrigerator,
  Tv,
  Microwave,
  CookingPot,
  Flame,
  Wind,
  Droplet,
  Fan,
  Wrench,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const PRODUCTS_DIR = path.join(ROOT, "public", "images", "services", "products");
const CONTEXT_DIR = path.join(ROOT, "public", "images", "services", "context");
fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
fs.mkdirSync(CONTEXT_DIR, { recursive: true });

function iconInnerMarkup(IconComponent, color) {
  const svg = renderToStaticMarkup(
    createElement(IconComponent, { strokeWidth: 1.6, color })
  );
  // Strip the outer <svg ...>...</svg> wrapper, keep just the path/shape markup.
  const match = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
  return match ? match[1] : svg;
}

// Same class of bug found (and fixed) in scripts/gen_banners.py during the
// Phase 3 final-polish pass: an unescaped "&" in an interpolated label
// makes the SVG invalid XML, which fails to render as an <img> (broken-
// image icon). None of today's product/context names contain XML-special
// characters, but escaping here defends against the same bug recurring if
// one ever does.
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// One shared, restrained template for every product/context illustration —
// deliberately NOT a per-item saturated gradient. `accent` (brand-600 by
// default) is the only spot of real color; everything else is neutral.
const TEMPLATE = ({ inner, label, accent = "#1f7267" }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2f1"/>
    </linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#bg)"/>
  <circle cx="320" cy="240" r="132" fill="${accent}" opacity="0.08"/>
  <circle cx="320" cy="240" r="96" fill="#ffffff" stroke="${accent}" stroke-opacity="0.25" stroke-width="1.5"/>
  <g transform="translate(258,178) scale(4.4)" fill="none" stroke="${accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>
`;

// Every product/context now shares the same brand-teal accent — the
// per-item hue variety (blue/orange/red/purple) that used to encode "which
// appliance is this" purely through color has been removed; the icon shape
// itself (plus the card's own name/description text) still identifies the
// product.
const ACCENT = "#1f7267";

const PRODUCTS = [
  { id: "air-conditioner", name: "Air Conditioner", Icon: AirVent },
  { id: "washing-machine", name: "Washing Machine", Icon: WashingMachine },
  { id: "refrigerator", name: "Refrigerator", Icon: Refrigerator },
  { id: "led-tv", name: "LED TV", Icon: Tv },
  { id: "microwave-oven", name: "Microwave Oven", Icon: Microwave },
  { id: "hob", name: "Hob", Icon: CookingPot },
  { id: "gas-stove", name: "Gas Stove", Icon: Flame },
  { id: "chimney", name: "Chimney", Icon: Wind },
  { id: "dishwasher", name: "Dishwasher", Icon: WashingMachine },
  { id: "ro", name: "RO Water Purifier", Icon: Droplet },
  { id: "air-purifier", name: "Air Purifier", Icon: Fan },
];

const CONTEXT = [
  { id: "context-1", name: "Technician tools", Icon: Wrench },
  { id: "context-2", name: "Technician visit", Icon: ShieldCheck },
  { id: "context-3", name: "Quality assured service", Icon: BadgeCheck },
];

for (const p of PRODUCTS) {
  const svg = TEMPLATE({ inner: iconInnerMarkup(p.Icon, ACCENT), label: p.name, accent: ACCENT });
  fs.writeFileSync(path.join(PRODUCTS_DIR, `${p.id}.svg`), svg);
  console.log("wrote", path.join(PRODUCTS_DIR, `${p.id}.svg`));
}

for (const c of CONTEXT) {
  const svg = TEMPLATE({ inner: iconInnerMarkup(c.Icon, ACCENT), label: c.name, accent: ACCENT });
  fs.writeFileSync(path.join(CONTEXT_DIR, `${c.id}.svg`), svg);
  console.log("wrote", path.join(CONTEXT_DIR, `${c.id}.svg`));
}
