// Generates original "city landmark" icon illustrations for the
// city/location selector.
//
// LANDMARK ARTWORK REVISION (this pass): the client reviewed the first
// version of these icons (generic glyphs — a plain mountain/ship/tree/
// building/waves/anchor per city, reused from lucide-react) and asked for
// each city to instead show a RECOGNIZABLE, city-specific landmark
// silhouette, in the spirit of their "INDIAN CITY ICONS" reference image
// (monochrome line-art monuments) — while still explicitly prohibiting
// copying that reference image or any other copyrighted artwork.
//
// Every path below is therefore drawn from scratch as a small set of
// primitive shapes (lines, arcs, simple curves) approximating each
// landmark's general silhouette and proportions — not traced or derived
// from any specific photo, illustration, or third-party SVG. None of these
// reproduce exact architectural detail, inscriptions, or ornamentation of
// the real structures; they are simplified, original line-art
// interpretations sized for small-card legibility, using the same
// restrained visual system as every other generated icon in this app
// (scripts/gen_illustrations.mjs: one brand-teal accent, a soft neutral
// circular badge, stroke-only linework, no per-item saturated color) so the
// whole set reads as one coherent "Indian city landmarks" collection.
//
// Run from the project root: node scripts/gen_location_icons.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT_DIR = path.join(ROOT, "public", "images", "locations");
fs.mkdirSync(OUT_DIR, { recursive: true });

const ACCENT = "#1f7267"; // same brand-teal accent used across every other generated icon

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Same shared badge frame as before (and as scripts/gen_illustrations.mjs) —
// only the linework inside `inner` changes in this revision. `inner` is
// raw SVG markup authored directly in a 24x24 coordinate space (the same
// space lucide-react icons used previously), so the existing
// translate/scale wrapper below needs no changes.
const TEMPLATE = ({ inner, label, accent = ACCENT }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${escapeXml(label)}">
  <circle cx="100" cy="100" r="92" fill="${accent}" opacity="0.08"/>
  <circle cx="100" cy="100" r="68" fill="#ffffff" stroke="${accent}" stroke-opacity="0.25" stroke-width="1.5"/>
  <g transform="translate(68,68) scale(1.55)" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>
`;

// One original, hand-drawn landmark silhouette per city — each a distinct
// recognizable shape (an arch, a dome, a beehive granary, a truss bridge, a
// temple spire, an industrial skyline) so every card is clearly
// distinguishable from the others at a glance, the same goal the previous
// generic-glyph version had, now met with a specific landmark identity
// instead of an interchangeable symbol.
const CITIES = [
  {
    slug: "ranchi",
    label: "Ranchi landmark illustration",
    // Jagannath Temple, Ranchi — a stepped, tiered shikhara (temple tower):
    // three progressively narrower stacked tiers on a small pillared
    // temple base with an arched doorway, topped with a rounded cap and
    // finial. Drawn as flat-topped stacked tiers (rather than a single
    // smooth taper) so it reads clearly as a stepped pagoda-style tower
    // rather than a plain cone/rocket shape at small sizes.
    inner: `
      <path d="M4 21H20"/>
      <path d="M6 21V17H18V21"/>
      <path d="M10 21V18.5A2 2 0 0 1 14 18.5V21"/>
      <path d="M8 17L9 13H15L16 17"/>
      <path d="M9 13L9.8 9.5H14.2L15 13"/>
      <path d="M9.8 9.5L10.6 6H13.4L14.2 9.5"/>
      <path d="M10.6 6Q12 4.6 13.4 6"/>
      <path d="M12 4.6V2.2"/>
      <circle cx="12" cy="1.8" r="0.7" fill="currentColor" stroke="none"/>
    `,
  },
  {
    slug: "delhi",
    label: "Delhi landmark illustration",
    // India Gate, Delhi — a triumphal arch: two flanking pillars, a flat
    // entablature bar, a single rounded archway, and a mast finial on top.
    inner: `
      <path d="M2 21H22"/>
      <path d="M5 21V6H8V21"/>
      <path d="M19 21V6H16V21"/>
      <path d="M4 6H20"/>
      <path d="M9 21V13A3 3 0 0 1 15 13V21"/>
      <path d="M12 5V2"/>
      <circle cx="12" cy="1.3" r="0.8" fill="currentColor" stroke="none"/>
    `,
  },
  {
    slug: "mumbai",
    label: "Mumbai landmark illustration",
    // Gateway of India, Mumbai — a monumental basalt archway with a tall
    // domed crown over a rectangular doorway, flanked by two small corner
    // finials. The doorway is drawn with straight sides (not another
    // curved arch) specifically so it reads as "block + dome" rather than
    // "three stacked arches" at small icon sizes.
    inner: `
      <path d="M2 21H22"/>
      <path d="M8 21V11"/>
      <path d="M16 21V11"/>
      <path d="M8 11H16"/>
      <path d="M10 21V14H14V21"/>
      <path d="M8 11A4 7 0 0 1 16 11"/>
      <path d="M12 4V2"/>
      <circle cx="12" cy="1.6" r="0.7" fill="currentColor" stroke="none"/>
      <path d="M4 21V16"/>
      <circle cx="4" cy="15.3" r="0.6" fill="currentColor" stroke="none"/>
      <path d="M20 21V16"/>
      <circle cx="20" cy="15.3" r="0.6" fill="currentColor" stroke="none"/>
    `,
  },
  {
    slug: "bengaluru",
    label: "Bengaluru landmark illustration",
    // Vidhana Soudha, Bengaluru — a wide, symmetrical domed legislative
    // building: a flat-roofed colonnaded block with a taller central dome.
    // The columns are drawn as mullions inside the building's own outline
    // (roofline to ground) rather than free-floating ticks beneath it, so
    // the shape reads as one solid building facade, not a "flask on legs."
    inner: `
      <path d="M2 21H22"/>
      <path d="M3 21V15H21V21"/>
      <path d="M9 15V10H15V15"/>
      <path d="M9 10Q9 5 12 5Q15 5 15 10"/>
      <path d="M12 5V3"/>
      <circle cx="12" cy="2.6" r="0.7" fill="currentColor" stroke="none"/>
      <path d="M5 15V19"/>
      <path d="M7 15V19"/>
      <path d="M17 15V19"/>
      <path d="M19 15V19"/>
    `,
  },
  {
    slug: "jamshedpur",
    label: "Jamshedpur landmark illustration",
    // Jamshedpur's steel-plant skyline (Tata Steel Works) — the city's
    // literal defining landmark: a low industrial shed with three chimneys
    // of different heights, the tallest venting smoke.
    inner: `
      <path d="M2 21H22"/>
      <path d="M3 21V17L7 14H21V21"/>
      <path d="M6 14V3"/>
      <path d="M8 14V3"/>
      <path d="M6 3H8"/>
      <path d="M12 14V7"/>
      <path d="M13.5 14V7"/>
      <path d="M12 7H13.5"/>
      <path d="M17 14V10"/>
      <path d="M18.5 14V10"/>
      <path d="M17 10H18.5"/>
      <path d="M6.2 2.2Q7 1.2 7.8 2.2"/>
      <path d="M7.4 1Q8.2 0 9 1"/>
    `,
  },
  {
    slug: "patna",
    label: "Patna landmark illustration",
    // Golghar, Patna — the city's distinctive beehive-shaped granary, with
    // its signature spiral exterior stairway and a small base entrance.
    inner: `
      <path d="M2 21H22"/>
      <path d="M5 21Q5 8 12 4Q19 8 19 21"/>
      <path d="M6 17Q12 15 18 17"/>
      <path d="M6.5 13Q12 11 17.5 13"/>
      <path d="M7.5 9Q12 7.5 16.5 9"/>
      <path d="M10 21V18A2 2 0 0 1 14 18V21"/>
      <path d="M12 4V2"/>
      <circle cx="12" cy="1.6" r="0.7" fill="currentColor" stroke="none"/>
    `,
  },
  {
    slug: "pune",
    label: "Pune landmark illustration",
    // Shaniwar Wada, Pune — a fortified palace gateway: two crenellated
    // bastion towers flanking a heavy arched entrance with iron-studded
    // doors.
    inner: `
      <path d="M2 21H22"/>
      <path d="M3 21V10H4.3V8H5.6V10H7V21"/>
      <path d="M17 21V10H18.4V8H19.7V10H21V21"/>
      <path d="M9 21V14A3 3 0 0 1 15 14V21"/>
      <circle cx="10.2" cy="19" r="0.4" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="19" r="0.4" fill="currentColor" stroke="none"/>
      <circle cx="13.8" cy="19" r="0.4" fill="currentColor" stroke="none"/>
      <circle cx="10.2" cy="17" r="0.4" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="17" r="0.4" fill="currentColor" stroke="none"/>
      <circle cx="13.8" cy="17" r="0.4" fill="currentColor" stroke="none"/>
    `,
  },
  {
    slug: "kolkata",
    label: "Kolkata landmark illustration",
    // Howrah Bridge, Kolkata — the city's iconic cantilever truss bridge:
    // twin pylons over a two-level deck, joined by a criss-cross lattice.
    inner: `
      <path d="M2 16H22"/>
      <path d="M4 19H20"/>
      <path d="M6 16L8 5L10 16"/>
      <path d="M14 16L16 5L18 16"/>
      <path d="M8 8L12 11L16 8"/>
      <path d="M8 12L12 9L16 12"/>
      <path d="M6 16V19"/>
      <path d="M10 16V19"/>
      <path d="M14 16V19"/>
      <path d="M18 16V19"/>
    `,
  },
];

for (const c of CITIES) {
  const svg = TEMPLATE({ inner: c.inner, label: c.label });
  fs.writeFileSync(path.join(OUT_DIR, `${c.slug}.svg`), svg);
  console.log("wrote", path.join(OUT_DIR, `${c.slug}.svg`));
}

// Neutral fallback used whenever a city has no iconUrl yet (new city added
// by a future Admin Panel before a landmark icon is uploaded) — kept as a
// plain, generic map-pin glyph (unchanged by this revision) since a
// fallback is intentionally NOT meant to look like any specific city.
const FALLBACK_INNER = `
  <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z"/>
  <circle cx="12" cy="9.5" r="2.4"/>
`;
const fallbackSvg = TEMPLATE({ inner: FALLBACK_INNER, label: "City" });
fs.writeFileSync(path.join(OUT_DIR, "fallback.svg"), fallbackSvg);
console.log("wrote", path.join(OUT_DIR, "fallback.svg"));
