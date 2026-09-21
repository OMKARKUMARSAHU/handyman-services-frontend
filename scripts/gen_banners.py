#!/usr/bin/env python3
"""Generates 4 generic, brand-neutral wide promotional banner SVGs for the
Spotlight section (public/images/offers/banner-1..4.svg). Original,
placeholder-quality graphics only — no Urban Company or third-party assets."""
import os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "images", "offers")
os.makedirs(OUT_DIR, exist_ok=True)

BANNERS = [
    ("banner-1.svg", "#2a8d7e", "#1f6d61", "Welcome Offer"),
    ("banner-2.svg", "#c2410c", "#9a3412", "Consumer Durables"),
    ("banner-3.svg", "#0369a1", "#075985", "AC AMC Launch"),
    ("banner-4.svg", "#0f766e", "#115e59", "Water & Air Purifiers"),
]

TEMPLATE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="{label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" fill="url(#g)"/>
  <circle cx="680" cy="90" r="140" fill="#ffffff" opacity="0.08"/>
  <circle cx="120" cy="340" r="110" fill="#ffffff" opacity="0.07"/>
  <text x="48" y="220" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="#ffffff">{label}</text>
</svg>
"""

for filename, c1, c2, label in BANNERS:
    path = os.path.join(OUT_DIR, filename)
    # Root cause of a real bug caught during the Phase 3 final-polish pass:
    # "Water & Air Purifiers" was interpolated into the SVG's aria-label
    # attribute and <text> content unescaped. The raw "&" made the SVG
    # invalid XML, which browsers can't parse when loading it via <img
    # src="...svg">, so that card rendered as a broken-image icon. XML-
    # escaping the label (handles &, <, >, " ) fixes it for every banner,
    # not just this one.
    safe_label = escape(label, {'"': "&quot;"})
    with open(path, "w") as f:
        f.write(TEMPLATE.format(c1=c1, c2=c2, label=safe_label))
    print(f"wrote {path}")
