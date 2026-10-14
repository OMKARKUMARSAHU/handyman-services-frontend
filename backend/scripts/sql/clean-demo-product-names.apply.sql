-- =============================================================================================
-- Remove "(Demo)" wording from the SAMPLE catalogue's text fields.            *** REVIEW BEFORE RUNNING ***
--
-- WHAT IT CHANGES (text columns only, and only on rows that carry the sample-data markers):
--   shop_products.name               "Refrigerator (Demo)"                      -> "Refrigerator"
--   shop_products.short_description  "Demo listing — refrigerator. Replace …"   -> "Refrigerator."
--   shop_products.description        "This is DEMO data created to preview …"   -> NULL
--   shop_categories.description      "Household … supplies. (Demo category)"    -> "Household … supplies."
--
-- WHAT IT NEVER TOUCHES: ids, slugs, SKUs, prices, MRP, stock, images/videos, categories, status/active/featured,
--   is_demo flag, city availability and city prices, carts, customer orders, order items (they keep their own
--   snapshot of the name), payments or any other table. It is not a Knex migration on purpose: migrations run
--   automatically on every deploy, whereas this must be run once, by you, after you have looked at the preview.
--
-- SAFETY:
--   * Run clean-demo-product-names.preview.sql first and check the rows it lists.
--   * Take a database backup / RDS snapshot first when running against production.
--   * Every old value is copied into the table shop_demo_cleanup_backup BEFORE the update, so
--     clean-demo-product-names.rollback.sql can restore it exactly. Re-running this script is safe (idempotent).
--   * Needs MySQL 8 (REGEXP_REPLACE).
--
-- Run:  mysql -u <user> -p --default-character-set=utf8mb4 <database> < clean-demo-product-names.apply.sql
-- =============================================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS shop_demo_cleanup_backup (
  kind              VARCHAR(16)  NOT NULL,            -- 'product' | 'category'
  row_id            CHAR(36)     NOT NULL,
  name              VARCHAR(255) NULL,
  short_description VARCHAR(500) NULL,
  description       TEXT         NULL,
  backed_up_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, row_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

START TRANSACTION;

-- 1) Back up the current values of the rows that will change (INSERT IGNORE keeps the FIRST backup on re-runs).
INSERT IGNORE INTO shop_demo_cleanup_backup (kind, row_id, name, short_description, description)
SELECT 'product', id, name, short_description, description
FROM shop_products
WHERE is_demo = 1
  AND (name LIKE '% (Demo)' OR short_description LIKE 'Demo listing%' OR description LIKE 'This is DEMO data created to preview%');

INSERT IGNORE INTO shop_demo_cleanup_backup (kind, row_id, name, short_description, description)
SELECT 'category', id, name, NULL, description
FROM shop_categories
WHERE description LIKE '% (Demo category)';

-- 2) Product names.
UPDATE shop_products
SET name = TRIM(REPLACE(name, ' (Demo)', ''))
WHERE is_demo = 1 AND name LIKE '% (Demo)';

-- 3) Product short descriptions: drop the "Demo listing — " prefix and the "Replace with your real product." tail,
--    then capitalise the first letter.
UPDATE shop_products
SET short_description = REGEXP_REPLACE(REPLACE(short_description, ' Replace with your real product.', ''), '^Demo listing[^A-Za-z0-9]+', '')
WHERE is_demo = 1 AND short_description LIKE 'Demo listing%';

UPDATE shop_products p
JOIN shop_demo_cleanup_backup b ON b.kind = 'product' AND b.row_id = p.id
SET p.short_description = CONCAT(UPPER(LEFT(p.short_description, 1)), SUBSTRING(p.short_description, 2))
WHERE b.short_description LIKE 'Demo listing%' AND p.short_description IS NOT NULL AND p.short_description <> '';

-- 4) The placeholder long description is removed entirely (no invented replacement text).
UPDATE shop_products
SET description = NULL
WHERE is_demo = 1 AND description LIKE 'This is DEMO data created to preview%';

-- 5) Category descriptions.
UPDATE shop_categories
SET description = TRIM(REPLACE(description, ' (Demo category)', ''))
WHERE description LIKE '% (Demo category)';

COMMIT;

-- 6) Result check — every list below should now be empty.
SELECT id, slug, name FROM shop_products WHERE name LIKE '%(Demo)%' OR short_description LIKE 'Demo listing%' OR description LIKE 'This is DEMO data%';
SELECT id, slug, name FROM shop_categories WHERE description LIKE '%(Demo category)%';

-- ---------------------------------------------------------------------------------------------
-- OPTIONAL, NOT EXECUTED — decide separately (remove the leading "-- " only if you want it):
--
-- (a) Public URLs still end in "-demo" (e.g. /products/refrigerator-demo). They are NOT changed above because
--     past customer orders store the old slug in order_items.product_slug (order history links would break) and
--     existing bookmarks / search results would 404. If you accept that, rename them with a collision check:
--
--   UPDATE shop_products p
--   SET p.slug = REGEXP_REPLACE(p.slug, '-demo$', '')
--   WHERE p.is_demo = 1 AND p.slug LIKE '%-demo'
--     AND NOT EXISTS (SELECT 1 FROM (SELECT slug FROM shop_products) s WHERE s.slug = REGEXP_REPLACE(p.slug, '-demo$', ''));
--
-- (b) SKUs keep their "DEMO-" prefix (they are identifiers, and you asked to preserve SKUs). The Admin product
--     list shows the SKU under each name. Order items keep their own SKU snapshot, so renaming product SKUs
--     would not alter any order. Ask for a separate reviewed script if you want this.
-- ---------------------------------------------------------------------------------------------
