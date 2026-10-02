-- ============================================================
-- 054_catalog_basket.sql — receive a customer's basket
--
-- Step 3 of docs/catalog-cart-plan.md. When a customer sends a basket from
-- the WhatsApp catalogue, Meta delivers a message of type `order`.
--
--   1. messages.content_type may now be 'order'.
--   2. messages.basket_payload (JSONB) holds the basket: the items checked
--      against our copy of the catalogue, the total, any problems found,
--      and the raw order exactly as Meta sent it.
--   3. notifications.type may now be 'basket_received', so the team is told
--      when a basket arrives.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Drop and re-add the CHECK, the same way migration 010 widened it for
-- 'interactive'. Migration 001 named it `messages_content_type_check`.
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'order'
  ));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS basket_payload JSONB;

-- Migration 027 created the column CHECK inline, so Postgres named it
-- `notifications_type_check`.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('conversation_assigned', 'basket_received'));
