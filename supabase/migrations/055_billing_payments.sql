-- ============================================================
-- 055_billing_payments.sql — WAGenie's own subscription billing
--
-- Phase R of docs/orders-payments-plan.md (the Razorpay review pack).
-- This is NOT the order payments of a business's own customers (that
-- is Phase 1, with the keys of each workspace). This table records
-- what a workspace Owner pays WAGenie: ₹2,500 for one month.
--
--   billing_payments   one row per attempt to pay, created when the
--                      Owner presses Pay and settled only after the
--                      server has verified Razorpay's signature and
--                      asked Razorpay for the payment itself.
--
-- Access
--   Admins and the Owner may read their own account's rows. Nobody
--   writes through the API with a user session: every insert/update
--   goes through the service role, after the server has checked the
--   payment. There is deliberately no INSERT/UPDATE policy, and the
--   paid-until date is read from this table, not stored on `accounts`,
--   so an admin cannot edit it through the REST API.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS billing_receipt_seq START 1;

CREATE TABLE IF NOT EXISTS billing_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Human receipt number, WAG-000001. Also sent to Razorpay as the
  -- order receipt so the two systems agree.
  receipt             TEXT NOT NULL UNIQUE
                        DEFAULT ('WAG-' || lpad(nextval('billing_receipt_seq')::text, 6, '0')),
  -- Nullable: the row is inserted first (to get the receipt), then the
  -- Razorpay order is created and its id attached.
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'paid', 'failed')),
  -- Set when status becomes 'paid': how far this payment extends access.
  access_until        TIMESTAMPTZ,
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_account
  ON billing_payments (account_id, created_at DESC);

ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view billing payments" ON billing_payments;
CREATE POLICY "Admins can view billing payments" ON billing_payments
  FOR SELECT USING (is_account_member(account_id, 'admin'));
