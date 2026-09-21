#!/usr/bin/env python3
"""
Regenerates the Phase 3 mock marketplace catalog (categories, products,
services, service-city availability, offers) from the client's approved
service/category list (chat message: "CLIENT CATALOG from the WhatsApp
conversation"). This REPLACES the earlier Phase 3 placeholder catalog,
which was always documented as illustrative, not final content.

Run from the project root: python3 scripts/gen_catalog.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data")

# ---------------------------------------------------------------------------
# Categories (client's 3 buckets: Consumer Durable / Kitchen Appliances /
# Other -> named "Water & Air Purifiers" since the client's WhatsApp list
# gave the two products under "OTHER CATEGORIES" without a bucket name;
# this is a content/naming choice, not a business rule, and is called out
# in the implementation report).
# ---------------------------------------------------------------------------
CATEGORIES = [
    {
        "id": "consumer-durables",
        "name": "Consumer Durables",
        "description": "Installation, service, repair and AMC for the appliances you rely on every day — AC, washing machine, refrigerator, TV and microwave.",
        "icon": "air-vent",
        "image": None,
        "applianceIds": [],
        "sortOrder": 1,
    },
    {
        "id": "kitchen-appliances",
        "name": "Kitchen Appliances",
        "description": "From built-in hobs to chimneys, keep the heart of your kitchen working smoothly.",
        "icon": "chef-hat",
        "image": None,
        "applianceIds": [],
        "sortOrder": 2,
    },
    {
        "id": "water-air-purifiers",
        "name": "Water & Air Purifiers",
        "description": "Installation and servicing for RO water purifiers and room air purifiers.",
        "icon": "filter",
        "image": None,
        "applianceIds": [],
        "sortOrder": 3,
    },
]

# ---------------------------------------------------------------------------
# Products (client's exact list; 11 products total)
# ---------------------------------------------------------------------------
PRODUCTS = [
    ("air-conditioner", "Air Conditioner", "consumer-durables", "air-vent",
     "Installation, servicing, gas top-up and repair for split and window air conditioners.", 599),
    ("washing-machine", "Washing Machine", "consumer-durables", "washing-machine",
     "Installation, repair and maintenance for front-load and top-load washing machines.", 399),
    ("refrigerator", "Refrigerator", "consumer-durables", "refrigerator",
     "Installation, cooling issues, noise and general refrigerator maintenance.", 449),
    ("led-tv", "LED TV", "consumer-durables", "tv",
     "Installation, wall-mounting and repair for LED and Smart TVs.", 349),
    ("microwave-oven", "Microwave Oven", "consumer-durables", "microwave",
     "Installation and repair for microwave ovens, OTGs and built-in ovens.", 299),
    ("hob", "Hob", "kitchen-appliances", "cooking-pot",
     "Installation and servicing for built-in gas and induction hobs.", 349),
    ("gas-stove", "Gas Stove", "kitchen-appliances", "flame",
     "Installation and servicing for gas stoves and cooktops.", 249),
    ("chimney", "Chimney", "kitchen-appliances", "wind",
     "Installation and deep cleaning for kitchen chimneys.", 499),
    ("dishwasher", "Dishwasher", "kitchen-appliances", "dishwasher",
     "Installation, maintenance and repair for built-in and freestanding dishwashers.", 449),
    ("ro", "RO Water Purifier", "water-air-purifiers", "droplet",
     "Installation, filter changes and servicing for RO/UV water purifiers.", 399),
    ("air-purifier", "Air Purifier", "water-air-purifiers", "fan",
     "Installation, filter replacement and servicing for room air purifiers.", 349),
]

SERVICE_TYPES = [
    ("installation", "Installation", 1.5),
    ("service", "Service", 1.0),
    ("repair", "Repair", 1.2),
    ("amc", "AMC", 3.0),
]

WHATS_INCLUDED = {
    "installation": ["Site/location inspection", "Professional installation", "Basic functionality check", "Post-installation cleanup"],
    "service": ["Multi-point inspection", "Cleaning & maintenance", "Performance check", "Digital service report"],
    "repair": ["Diagnosis of the issue", "Repair & testing (spare parts extra if required)", "30-day service warranty", "Digital service report"],
    "amc": ["2 scheduled services per year", "Priority breakdown support", "Discounted spare parts", "Free diagnostic visits"],
}

CONTEXT_IMAGES = [f"/images/services/context/context-{i}.svg" for i in range(1, 4)]


def images_for_product(product_id, n_images):
    """First image is always this product's own themed illustration
    (public/images/services/products/<id>.svg, see gen_illustrations.mjs);
    remaining gallery slots cycle through the 3 generic "service context"
    illustrations (tools / verified technician / quality). This replaces
    the earlier fully-generic, text-labelled placeholder set."""
    urls = [f"/images/services/products/{product_id}.svg"]
    for i in range(n_images - 1):
        urls.append(CONTEXT_IMAGES[i % len(CONTEXT_IMAGES)])
    return urls

CITIES = ["ranchi", "delhi", "mumbai", "bengaluru", "jamshedpur", "patna", "pune", "kolkata"]
POPULAR_CITIES = {"ranchi", "delhi", "mumbai", "bengaluru"}


def build_products():
    out = []
    for i, (pid, name, cat, icon, desc, _base) in enumerate(PRODUCTS, start=1):
        out.append({
            "id": pid,
            "slug": pid,
            "name": name,
            "description": desc,
            "icon": icon,
            "image": None,
            "categoryId": cat,
            "sortOrder": i,
            "active": True,
        })
    return out


def build_services():
    out = []
    sort_order = 1
    most_booked_targets = {
        ("air-conditioner", "service"), ("air-conditioner", "amc"),
        ("washing-machine", "repair"), ("refrigerator", "service"),
        ("chimney", "service"), ("ro", "installation"),
        ("led-tv", "installation"), ("gas-stove", "repair"),
    }
    featured_targets = {
        ("air-purifier", "installation"), ("dishwasher", "installation"),
        ("hob", "service"), ("microwave-oven", "repair"),
        ("washing-machine", "amc"), ("refrigerator", "amc"),
        ("chimney", "repair"), ("ro", "amc"),
    }
    no_rating_targets = {("gas-stove", "installation"), ("hob", "amc"), ("dishwasher", "repair")}
    zero_discount_target = ("air-conditioner", "installation")
    high_discount_target = ("air-purifier", "amc")
    single_image_target = ("led-tv", "repair")
    five_image_target = ("air-conditioner", "service")

    rating_pool = [4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1]
    count_pool = [1280, 964, 812, 601, 455, 322, 210, 128, 76, 44]
    ri = 0

    for pid, pname, cat, icon, _desc, base_price in PRODUCTS:
        for type_key, type_label, multiplier in SERVICE_TYPES:
            key = (pid, type_key)
            offer_price = round(base_price * multiplier / 10) * 10

            if key == zero_discount_target:
                mrp = offer_price
            elif key == high_discount_target:
                mrp = round(offer_price / 0.55 / 10) * 10  # ~45% off
            else:
                mrp = round(offer_price / 0.85 / 10) * 10  # ~15% off

            if key in no_rating_targets:
                rating_average = None
                rating_count = 0
            else:
                rating_average = rating_pool[ri % len(rating_pool)]
                rating_count = count_pool[ri % len(count_pool)]
                ri += 1

            if key == single_image_target:
                n_images = 1
            elif key == five_image_target:
                n_images = 5
            else:
                n_images = 3 + (sort_order % 2)  # alternates 3/4

            images = []
            urls = images_for_product(pid, n_images)
            for img_i, url in enumerate(urls):
                images.append({
                    "id": f"img-{pid}-{type_key}-{img_i + 1}",
                    "serviceId": f"{pid}-{type_key}",
                    "url": url,
                    "alt": f"{pname} {type_label} — photo {img_i + 1}",
                    "sortOrder": img_i + 1,
                })

            out.append({
                "id": f"{pid}-{type_key}",
                "slug": f"{pid}-{type_key}",
                "productId": pid,
                "serviceTypeId": type_key,
                "name": f"{pname} {type_label}",
                "shortDescription": f"{type_label} for your {pname.lower()}, by verified technicians.",
                "description": (
                    f"Professional {type_label.lower()} for {pname.lower()}. "
                    f"{WHATS_INCLUDED[type_key][0]} and {WHATS_INCLUDED[type_key][1].lower()} "
                    f"are handled by background-verified technicians, with a digital record of "
                    f"the work done."
                ),
                "whatsIncluded": WHATS_INCLUDED[type_key],
                "images": images,
                "mrp": mrp,
                "offerPrice": offer_price,
                "ratingAverage": rating_average,
                "ratingCount": rating_count,
                "isMostBooked": key in most_booked_targets,
                "featured": key in featured_targets,
                "active": True,
                "sortOrder": sort_order,
            })
            sort_order += 1
    return out


def build_availability(services):
    out = []
    row_id = 1
    for svc in services:
        sid = svc["id"]
        for city in CITIES:
            if city in POPULAR_CITIES:
                active = True
            else:
                # Deterministic skip pattern for smaller cities, preserved
                # from the original Phase 3 mock data so empty-state /
                # partial-availability QA cases still exist after the
                # catalog swap: AMC not yet offered outside popular cities,
                # and every 5th service skipped in the remaining cities.
                if svc["serviceTypeId"] == "amc":
                    active = False
                else:
                    active = (row_id % 5) != 0
            out.append({
                "id": f"avail-{row_id}",
                "serviceId": sid,
                "cityId": city,
                "active": active,
            })
            row_id += 1
    return out


def build_offers():
    return [
        {
            "id": "offer-welcome10",
            "title": "Welcome Offer — 10% off",
            "description": "10% off your first booking, site-wide.",
            "discountType": "percent",
            "discountValue": 10,
            "appliesTo": {"scope": "all", "ids": []},
            "bannerImage": "/images/offers/banner-1.svg",
            "startDate": None,
            "endDate": None,
            "active": True,
        },
        {
            "id": "offer-consumer-durables",
            "title": "Consumer Durables Special",
            "description": "Flat ₹100 off on Consumer Durables category services.",
            "discountType": "flat",
            "discountValue": 100,
            "appliesTo": {"scope": "category", "ids": ["consumer-durables"]},
            "bannerImage": "/images/offers/banner-2.svg",
            "startDate": None,
            "endDate": None,
            "active": True,
        },
        {
            "id": "offer-amc-launch",
            "title": "AC AMC Launch Offer",
            "description": "15% off Air Conditioner AMC plans this month.",
            "discountType": "percent",
            "discountValue": 15,
            "appliesTo": {"scope": "service", "ids": ["air-conditioner-amc"]},
            "bannerImage": "/images/offers/banner-3.svg",
            "startDate": None,
            "endDate": None,
            "active": True,
        },
        {
            "id": "offer-water-air-purifiers",
            "title": "Water & Air Purifier Offer",
            "description": "Flat ₹150 off on RO and Air Purifier services.",
            "discountType": "flat",
            "discountValue": 150,
            "appliesTo": {"scope": "category", "ids": ["water-air-purifiers"]},
            "bannerImage": "/images/offers/banner-4.svg",
            "startDate": None,
            "endDate": None,
            "active": True,
        },
    ]


def build_legacy_appliances():
    """Keep the legacy /services and /plans routes (appliances.json) in
    sync with the new category ids so they don't silently break — same
    product set, mapped onto the new 3-category structure."""
    out = []
    for pid, name, cat, icon, desc, _base in PRODUCTS:
        out.append({
            "id": pid,
            "name": name,
            "categoryId": cat,
            "icon": icon,
            "description": desc,
            "image": None,
        })
    return out


def main():
    products = build_products()
    services = build_services()
    availability = build_availability(services)
    offers = build_offers()
    appliances = build_legacy_appliances()

    categories = CATEGORIES
    for cat in categories:
        cat["applianceIds"] = [p["id"] for p in products if p["categoryId"] == cat["id"]]

    def dump(name, data):
        path = os.path.join(DATA, name)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"wrote {path} ({len(data)} records)")

    dump("categories.json", categories)
    dump("products.json", products)
    dump("services.json", services)
    dump("serviceCityAvailability.json", availability)
    dump("offers.json", offers)
    dump("appliances.json", appliances)


if __name__ == "__main__":
    main()
