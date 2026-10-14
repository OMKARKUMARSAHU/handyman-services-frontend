-- =============================================================================================
-- ROLLBACK for clean-demo-product-names.apply.sql
-- Restores name / short_description / description exactly as they were, from shop_demo_cleanup_backup.
-- The backup table itself is kept (drop it manually once you are sure: DROP TABLE shop_demo_cleanup_backup;).
--
-- Run:  mysql -u <user> -p --default-character-set=utf8mb4 <database> < clean-demo-product-names.rollback.sql
-- =============================================================================================
SET NAMES utf8mb4;
START TRANSACTION;

UPDATE shop_products p
JOIN shop_demo_cleanup_backup b ON b.kind = 'product' AND b.row_id = p.id
SET p.name = b.name, p.short_description = b.short_description, p.description = b.description;

UPDATE shop_categories c
JOIN shop_demo_cleanup_backup b ON b.kind = 'category' AND b.row_id = c.id
SET c.name = b.name, c.description = b.description;

COMMIT;

SELECT COUNT(*) AS restored_products FROM shop_products p JOIN shop_demo_cleanup_backup b ON b.kind = 'product' AND b.row_id = p.id AND b.name = p.name;
