-- ============================================================
-- 053_catalog_item_variants.sql — size and colour on catalogue items
--
-- Step 2 of docs/catalog-cart-plan.md (the product picker in the inbox).
-- In the real catalogue, 74 product names are shared by several items:
-- every variant carries the same name, and Meta tells them apart by
-- `size` and `color` (for example "Mini Jewellery Box" has 18 colours).
-- Without these two columns the picker cannot show an agent which variant
-- they are about to send.
--
-- Run "Sync now" in Settings, Catalogue after applying this, so the new
-- columns fill in.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS size  TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT;
