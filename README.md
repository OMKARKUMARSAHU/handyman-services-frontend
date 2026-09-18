# Handyman Services — Website Frontend

This repository contains the **frontend implementation** of the Handyman Services website: a marketing and service-discovery site for an appliance repair and maintenance subscription business (Silver / Gold / Platinum annual plans).

It is a standalone Next.js application. It renders the full public-facing site — home, service categories, plans, and supporting pages — from local, data-driven content, and is structured so its data source can be swapped for a real backend later without rewriting the UI (see [Architecture](#architecture)).

## Technology stack

- **[Next.js 16](https://nextjs.org/)** (App Router, Turbopack)
- **React 19** + **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **[lucide-react](https://lucide.dev/)** for icons
- **clsx** for conditional class names

No database driver, ORM, authentication library, or payment SDK is included.

## Routes / pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, category browser, plan comparison, how it works, testimonials, FAQ preview, CTA |
| `/services` | Service category listing |
| `/services/[category]` | Category detail (statically generated for each category: cooling, kitchen-appliances, water-heating, laundry, entertainment) |
| `/plans` | Plans & pricing (Silver / Gold / Platinum) |
| `/about` | About the business |
| `/faq` | Full FAQ list |
| `/contact` | "Request a Service" contact form |
| `/privacy` | Privacy Policy |
| `/terms` | Terms & Conditions |
| `/robots.txt`, `/sitemap.xml` | Generated via `src/app/robots.ts` / `src/app/sitemap.ts` |

The header also includes frontend-only search, location, account, and cart controls (see [Not currently implemented](#not-currently-implemented)) — these are UI affordances, not separate routes.

## Project structure

```
src/
  app/                  Next.js App Router pages & routes (table above)
  components/
    ui/                 Generic building blocks (Button, Container, Badge, ...)
    layout/              Header, Footer, mobile menu, sticky CTA, WhatsApp button,
                          and the header's search/location/account/cart controls
    home/                Homepage sections (Hero, category grid, FAQ, testimonials, ...)
    plans/               Plan comparison components
    services/            Category/service detail components
    forms/               Contact / "Request a Service" form
  data/                  Local JSON content (plans, categories, appliances, FAQs, ...)
  lib/
    data/                Data Access Layer — see below
    icons.tsx            Shared icon set
    format.ts, utils.ts  Small helpers
  types/                 Shared TypeScript types for every data entity
public/
  images/                Image assets, organized by use (hero/, categories/, services/);
                         each subfolder documents the exact filenames and sizes expected
```

## Architecture

Business content flows through a single seam, so the UI does not need to change when a real backend is introduced:

```
Frontend (pages & components)
        ↓
Data Access Layer (src/lib/data/*)
        ↓
Current mock/local data (src/data/*.json)
        ↓
Future backend/API (not yet implemented)
```

Every page and component reads content through functions exported from `src/lib/data/` (for example `getPlans()`, `getCategories()`, `getFAQs()`) — never by importing JSON files directly. Today, those functions read the local JSON files in `src/data/`. The intent is that this layer could later be pointed at WordPress/WooCommerce or a custom API by changing only the internals of these functions, without requiring a full UI rewrite — but **no such backend or API integration exists in this repository today**; this is a design intent for future work, not a built feature.

## Data-driven content and mock data

All business content — plan pricing and features, service categories and appliances, testimonials, FAQs, contact details, and homepage copy — lives in `src/data/*.json` and is typed in `src/types/index.ts`. Components never hardcode this content directly.

This data is currently **mock/placeholder data** and must be reviewed and confirmed by the business before a production launch — in particular plan pricing, appliance coverage, FAQ answers, and contact details. Some entities (e.g. plans, FAQs) carry an internal `*Confirmed` boolean flag in their data for tracking this, independent of what is rendered.

Image assets referenced by category/appliance/hero data are optional and fall back to a placeholder treatment in the UI when unset — see the `README.md` files inside each `public/images/` subfolder for what's expected.

## Not currently implemented

This is a frontend-only build. The following are **not** present in this repository:

- Backend server / API
- Database
- Authentication or login (the header's account icon is a UI placeholder only)
- Admin panel
- Payment gateway
- Real booking or scheduling system
- Production API integration
- Chatbot

The "Request a Service" contact form and the header's search/location/account/cart controls are all functional in the browser (client-side filtering, `localStorage`, form validation, etc.), but none of them call a real backend — form submission is a mock function that simulates a short delay and does not send data anywhere.

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## npm scripts

```bash
npm run dev     # start the local development server
npm run build   # create a production build (also type-checks)
npm run lint    # run ESLint
npm run start   # serve the production build
```

## Production build

```bash
npm run build
npm run start
```

`npm run build` compiles and type-checks the app and generates static output for every route listed above; `npm run start` serves that build locally on [http://localhost:3000](http://localhost:3000).

## Project status

The frontend implementation is complete, and it has been tested for build correctness, responsive layout, accessibility, and basic performance. Backend integration, authentication, an admin panel, payment processing, a real booking system, and any chatbot functionality are **future scope** and have not been started.

## Development notes

- No environment variables are required to run this project as-is; it has no external service dependencies.
- Type-checking on its own can be run with `npx tsc --noEmit` (not a defined npm script, but available via the `typescript` dev dependency).
- Deeper design and planning documentation for this project (requirements, architecture rationale, phase-by-phase reports) is kept outside this directory and is not required to build, run, or deploy the site.
