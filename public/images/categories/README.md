# Category images

Drop these 5 files here, then set each category's `image` field in
`src/data/categories.json` to the matching path below.

| Category | Recommended filename | Path to set in data |
|---|---|---|
| Cooling | `cooling.jpg` | `/images/categories/cooling.jpg` |
| Kitchen Appliances | `kitchen-appliances.jpg` | `/images/categories/kitchen-appliances.jpg` |
| Water & Heating | `water-heating.jpg` | `/images/categories/water-heating.jpg` |
| Laundry | `laundry.jpg` | `/images/categories/laundry.jpg` |
| Entertainment | `entertainment.jpg` | `/images/categories/entertainment.jpg` |

- Aspect ratio: 4:3 (cards crop to this ratio automatically)
- Recommended size: at least 800×600px, JPG or WebP, optimized for web (target well under 150KB each — these appear multiple times per page, e.g. homepage + /services)
- Subject: something that immediately communicates the category — e.g. an AC/technician for Cooling, a kitchen appliance/technician for Kitchen Appliances, a geyser/water heater for Water & Heating, a washing machine for Laundry, a television for Entertainment

Until real files are added, each card shows a polished neutral icon panel
instead of a broken image — no code change is needed later, only the
`image` field per category.
