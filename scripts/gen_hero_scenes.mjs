// Generates the homepage hero's right-side photographic-style collage
// panels (Phase 3 "major homepage visual rework" pass, item 3/4/6).
//
// The client asked for a large photographic image collage (technician
// servicing an appliance, repairing an appliance, a home service visit, a
// technician in a kitchen) in place of the old green icon mosaic. This
// environment cannot fetch real stock photography (outbound access to
// Unsplash/Pexels/Pixabay-style CDNs is blocked by org egress policy, and
// the fetch tool available here does not support image content at all —
// the same constraint recorded in PHASE_4_FRONTEND_POLISH_REPORT.md). Per
// the client's own fallback instruction ("if you cannot safely source
// suitable images... keep the image slots, create clean placeholders...
// make the layout ready so images can be inserted later"), these are
// original, generated "scene" illustrations — a simple technician
// silhouette + the relevant appliance icon on a warm neutral (not
// saturated-green) background — standing in for real photography. Each
// panel is rendered by HeroCollage.tsx through the same onError/fallback
// pattern as OfferBannerImage, and swapping in a real photo later is a
// one-line change to each scene's `image` path — no component changes.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AirVent, Wrench, Home, ChefHat } from "lucide-react";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT_DIR = path.join(ROOT, "public", "images", "hero");
fs.mkdirSync(OUT_DIR, { recursive: true });

function iconInnerMarkup(IconComponent, color, strokeWidth = 1.5) {
  const svg = renderToStaticMarkup(createElement(IconComponent, { strokeWidth, color }));
  const match = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
  return match ? match[1] : svg;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A plain, generic technician silhouette (head + torso + one raised arm) —
// simple geometric shapes, not a traced/copied figure from any source.
const PERSON = `
  <circle cx="0" cy="-58" r="17" />
  <path d="M -22 30 C -22 -6 -16 -24 0 -24 C 16 -24 22 -6 22 30 L 22 62 L -22 62 Z" />
  <path d="M 16 -14 L 34 -30" />
`;

const TEMPLATE = ({ inner, label, accent }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4f1ea"/>
      <stop offset="100%" stop-color="#e7e2d8"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <circle cx="150" cy="120" r="180" fill="#ffffff" opacity="0.35"/>
  <circle cx="500" cy="520" r="220" fill="${accent}" opacity="0.07"/>
  <g transform="translate(240,430) scale(2.3)" fill="none" stroke="#3a4441" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    ${PERSON}
  </g>
  <g transform="translate(300,150) scale(7.5)" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>
`;

const ACCENT = "#1f7267";

const SCENES = [
  { id: "scene-1", name: "Technician servicing an air conditioner", Icon: AirVent },
  { id: "scene-2", name: "Technician repairing a home appliance", Icon: Wrench },
  { id: "scene-3", name: "Home appliance service visit", Icon: Home },
  { id: "scene-4", name: "Technician servicing a kitchen appliance", Icon: ChefHat },
];

for (const s of SCENES) {
  const svg = TEMPLATE({ inner: iconInnerMarkup(s.Icon, ACCENT, 1.5), label: s.name, accent: ACCENT });
  fs.writeFileSync(path.join(OUT_DIR, `${s.id}.svg`), svg);
  console.log("wrote", path.join(OUT_DIR, `${s.id}.svg`));
}
