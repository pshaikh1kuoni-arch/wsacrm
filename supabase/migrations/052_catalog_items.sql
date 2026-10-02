-- ============================================================
-- 052_catalog_items.sql — a copy of the Meta product catalogue
--
-- Backs the catalogue and basket feature (docs/catalog-cart-plan.md):
--   1. catalog_items  one row per catalogue item (a variant is its own
--                     item). Filled by "Sync now" in Settings, read by
--                     the product picker and the basket check. The CRM
--                     only ever reads the catalogue from Meta; it never
--                     writes to it.
--   2. whatsapp_config gains catalog_id, catalog_name and
--                     catalog_synced_at, so the app knows which catalogue
--                     it copied and when.
--
-- Prices are stored as numbers parsed from Meta's text ("₹1,210.00").
-- `sale_price_amount` is kept next to `price_amount` because most of the
-- real catalogue carries a lower sale price, and that is what the
-- customer sees in WhatsApp.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  catalog_id        TEXT NOT NULL,
  -- Meta's own ID for the item, and the retailer ID from the feed. The
  -- retailer ID is what a customer's basket carries, so it is the key.
  retailer_id       TEXT NOT NULL,
  meta_item_id      TEXT,
  -- Variants of one product share a group ID.
  group_id          TEXT,
  name              TEXT NOT NULL,
  price_amount      NUMERIC(12, 2),
  sale_price_amount NUMERIC(12, 2),
  currency          TEXT,
  availability      TEXT NOT NULL DEFAULT 'other'
                      CHECK (availability IN ('in_stock', 'out_of_stock', 'other')),
  image_url         TEXT,
  product_url       TEXT,
  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, retailer_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_account_name
  ON catalog_items(account_id, lower(name));

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- Every member (viewer and up) may read; writes go through the service
-- role (the sync route), which bypasses RLS.
DROP POLICY IF EXISTS "Members can view catalogue items" ON catalog_items;
CREATE POLICY "Members can view catalogue items" ON catalog_items
  FOR SELECT USING (is_account_member(account_id));

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS catalog_id        TEXT,
  ADD COLUMN IF NOT EXISTS catalog_name      TEXT,
  ADD COLUMN IF NOT EXISTS catalog_synced_at TIMESTAMPTZ;
