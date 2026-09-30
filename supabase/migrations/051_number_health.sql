-- ============================================================
-- 051_number_health.sql — WhatsApp number health tracking
--
-- Backs the "Number health" page:
--   1. number_health         current quality rating + messaging limit
--                            tier per account (one number per account).
--   2. number_health_events  history of every change Meta reports, from
--                            the phone_number_quality_update and
--                            account_update webhooks or from a sync.
--   3. number_health_daily_volume(...)  messages per day for one account.
--   4. number_health_platform_summary() cross-account message counts for
--                            the Tech Partner progress card. service_role
--                            only — the API route gates it to configured
--                            operators (PARTNER_OPERATOR_EMAILS).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS number_health (
  account_id           UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id      TEXT NOT NULL,
  display_phone_number TEXT,
  verified_name        TEXT,
  quality_rating       TEXT NOT NULL DEFAULT 'unknown'
                         CHECK (quality_rating IN ('high', 'medium', 'low', 'unknown')),
  messaging_limit_tier TEXT,
  name_status          TEXT,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE number_health ENABLE ROW LEVEL SECURITY;

-- Every member (viewer and up) may read; writes go through the service
-- role (webhook + sync), which bypasses RLS.
DROP POLICY IF EXISTS "Members can view number health" ON number_health;
CREATE POLICY "Members can view number health" ON number_health
  FOR SELECT USING (is_account_member(account_id));

CREATE TABLE IF NOT EXISTS number_health_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  kind            TEXT NOT NULL
                    CHECK (kind IN ('quality_change', 'limit_change', 'meta_event')),
  previous_value  TEXT,
  new_value       TEXT,
  meta_event      TEXT,
  source          TEXT NOT NULL CHECK (source IN ('webhook', 'sync')),
  detail          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_number_health_events_account_created
  ON number_health_events(account_id, created_at DESC);

ALTER TABLE number_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view number health events" ON number_health_events;
CREATE POLICY "Members can view number health events" ON number_health_events
  FOR SELECT USING (is_account_member(account_id));

-- Messages per local day for one account. SECURITY DEFINER with an
-- explicit membership check so it does not depend on the messages RLS
-- policy shape; `p_tz` lets the page bucket days in the viewer's zone.
CREATE OR REPLACE FUNCTION number_health_daily_volume(
  p_account_id UUID,
  p_days       INT  DEFAULT 30,
  p_tz         TEXT DEFAULT 'UTC'
)
RETURNS TABLE(day DATE, inbound BIGINT, outbound BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_account_member(p_account_id) THEN
    RAISE EXCEPTION 'not a member of this account' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (m.created_at AT TIME ZONE p_tz)::date AS day,
    COUNT(*) FILTER (WHERE m.sender_type = 'customer')  AS inbound,
    COUNT(*) FILTER (WHERE m.sender_type <> 'customer') AS outbound
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE c.account_id = p_account_id
    AND m.created_at >= (
      date_trunc('day', now() AT TIME ZONE p_tz)
      - make_interval(days => GREATEST(p_days, 1) - 1)
    ) AT TIME ZONE p_tz
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION number_health_daily_volume(UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION number_health_daily_volume(UUID, INT, TEXT) TO authenticated, service_role;

-- Cross-account message counts for accounts with a connected number.
-- An account is an "active customer" when messages_30d > 0.
CREATE OR REPLACE FUNCTION number_health_platform_summary()
RETURNS TABLE(
  account_id      UUID,
  account_name    TEXT,
  messages_30d    BIGINT,
  messages_7d     BIGINT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.name,
    COUNT(m.id),
    COUNT(m.id) FILTER (WHERE m.created_at >= now() - interval '7 days'),
    MAX(m.created_at)
  FROM accounts a
  JOIN whatsapp_config w ON w.account_id = a.id AND w.status = 'connected'
  LEFT JOIN conversations c ON c.account_id = a.id
  LEFT JOIN messages m
    ON m.conversation_id = c.id
   AND m.created_at >= now() - interval '30 days'
  GROUP BY a.id, a.name
  ORDER BY 3 DESC;
$$;

REVOKE ALL ON FUNCTION number_health_platform_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION number_health_platform_summary() TO service_role;
