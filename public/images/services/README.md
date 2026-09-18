# Appliance images

Drop these files here, then set the matching appliance's `image` field in
`src/data/appliances.json` to the path below. These thumbnails appear on
each service/category detail page (`/services/[category]`).

| Appliance | Recommended filename | Path to set in data |
|---|---|---|
| Air Conditioner | `air-conditioner.jpg` | `/images/services/air-conditioner.jpg` |
| Ceiling Fans | `ceiling-fan.jpg` | `/images/services/ceiling-fan.jpg` |
| Refrigerator | `refrigerator.jpg` | `/images/services/refrigerator.jpg` |
| Microwave / OTG | `microwave-oven.jpg` | `/images/services/microwave-oven.jpg` |
| Built-In Hob | `built-in-hob.jpg` | `/images/services/built-in-hob.jpg` |
| Kitchen Chimney | `kitchen-chimney.jpg` | `/images/services/kitchen-chimney.jpg` |
| Dishwasher | `dishwasher.jpg` | `/images/services/dishwasher.jpg` |
| Cooking Range | `cooking-range.jpg` | `/images/services/cooking-range.jpg` |
| Water Purifier | `water-purifier.jpg` | `/images/services/water-purifier.jpg` |
| Geyser / Water Heater | `geyser.jpg` | `/images/services/geyser.jpg` |
| Washing Machine | `washing-machine.jpg` | `/images/services/washing-machine.jpg` |
| Television | `television.jpg` | `/images/services/television.jpg` |

- Aspect ratio: 1:1 (square thumbnails, cropped automatically to a small rounded square)
- Recommended size: at least 200×200px, JPG or WebP, optimized for web (target well under 50KB each — up to 12 may load on one page)
- Subject: the appliance itself, or a technician actively servicing it, shot clearly enough to read at small (40×40px) display size

Until real files are added, each list item shows the existing category icon
in a rounded badge instead of a broken image — no code change is needed
later, only the `image` field per appliance.
