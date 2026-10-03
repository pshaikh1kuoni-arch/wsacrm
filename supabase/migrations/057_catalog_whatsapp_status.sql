-- ============================================================
-- 057_catalog_whatsapp_status.sql — Meta's WhatsApp review of each item
--
-- Step 5 of docs/catalog-cart-plan.md (the picker warning). Meta keeps a
-- separate WhatsApp review status for every catalogue item. It will not send
-- an item whose status is OUTDATED: a product list drops it silently and a
-- single product message is refused. The picker uses this column to warn
-- before an agent sends such an item.
--
--   catalog_items.whatsapp_status   'approved' | 'outdated' | 'no_review' |
--                                   'other'. NULL until the next catalogue
--                                   sync after this migration has run.
--
-- No CHECK constraint on purpose: Meta can add statuses, and the sync maps
-- anything it does not know to 'other'.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS whatsapp_status TEXT;
