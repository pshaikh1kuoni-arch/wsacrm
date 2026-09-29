-- ============================================================
-- 050_flow_followups_disabled.sql — durable "stop contacting me" flag
--
-- `conversations.ai_autoreply_disabled` (migration 029) already exists
-- but only gates the standalone auto-reply bot's own eligibility check.
-- It doesn't cover Flows' scheduled follow-up machinery
-- (`wait_followup` node, `ai_agent`'s "stay in charge" reminders), and
-- reusing it there would conflate two different facts: "the bot should
-- stop replying to new inbound messages" vs "this contact should never
-- receive another automated, unprompted touch — a reminder, a
-- re-engage nudge, a future broadcast."
--
-- `ai_followups_disabled` is the second, narrower fact. Set once,
-- permanently, the moment a customer asks not to be contacted again
-- (WhatsApp/SMS opt-out convention: STOP / UNSUBSCRIBE / QUIT, or the
-- AI recognising an equivalent natural-language request). Checked by
-- every place that schedules or fires an automated touch — see
-- `hasFollowupsDisabled` in src/lib/flows/engine.ts. A direct reply to
-- something the customer asks is never gated by this; only unprompted
-- automated messages are.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_followups_disabled boolean NOT NULL DEFAULT false;
