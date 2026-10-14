-- =============================================================================================
-- PREVIEW (read-only) for clean-demo-product-names.apply.sql
-- Lists exactly which rows the clean-up would change. It contains SELECT statements only.
--
-- Run:  mysql -u <user> -p --default-character-set=utf8mb4 <database> < clean-demo-product-names.preview.sql
-- =============================================================================================
SET NAMES utf8mb4;

-- 1) Products that the apply script would touch (only rows flagged is_demo = 1; real products are never matched).
SELECT id, slug, sku, name AS current_name,
       REPLACE(name, ' (Demo)', '') AS new_name,
       short_description AS current_short_description,
       description IS NOT NULL AND description LIKE 'This is DEMO data created to preview%' AS description_is_placeholder
FROM shop_products
WHERE is_demo = 1
  AND (name LIKE '% (Demo)' OR short_description LIKE 'Demo listing%' OR description LIKE 'This is DEMO data created to preview%')
ORDER BY name;

-- 2) Categories whose description ends in the "(Demo category)" marker.
SELECT id, slug, name, description AS current_description, REPLACE(description, ' (Demo category)', '') AS new_description
FROM shop_categories
WHERE description LIKE '% (Demo category)'
ORDER BY name;

-- 3) Products flagged is_demo = 1 that the script will NOT rename (their name has no " (Demo)" suffix) — for your information.
SELECT id, slug, sku, name FROM shop_products WHERE is_demo = 1 AND name NOT LIKE '% (Demo)';

-- 4) Sanity: non-demo (real) products are never touched.
SELECT COUNT(*) AS real_products_untouched FROM shop_products WHERE is_demo = 0;
