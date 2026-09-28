-- ============================================================
-- 049_flow_any_message_trigger.sql — new `any_message` Flow trigger
--
-- Adds a fourth flow trigger type alongside 'keyword',
-- 'first_inbound_message', and 'manual': a flow can now be set to start
-- on ANY inbound message, from any contact, at any time — not just a
-- specific keyword or a contact's very first-ever message.
--
-- `findEntryFlow` (src/lib/flows/engine.ts) only reaches this trigger
-- as a fallback, after checking every flow for a more specific
-- keyword/first-message match, and only when the conversation's
-- ownership gate resolves to "none" (nobody — no human, no active AI
-- reply streak — already owns the thread). That gate already existed
-- before this migration; this just adds a trigger type that can use it.
--
-- No trigger_config needed — same as first_inbound_message/manual.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE flows
  DROP CONSTRAINT IF EXISTS flows_trigger_type_check;

ALTER TABLE flows
  ADD CONSTRAINT flows_trigger_type_check
  CHECK (trigger_type IN (
    'keyword', 'first_inbound_message', 'manual', 'any_message'
  ));
