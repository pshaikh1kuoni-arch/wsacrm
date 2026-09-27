-- ============================================================
-- 045_ai_agent_node_type.sql — new `ai_agent` Flow node type
--
-- Lets a Flow step hand a moment of the conversation to the account's
-- configured AI (same provider/key/knowledge base as the standalone
-- auto-reply bot and the Inbox "Draft with AI" button). Bounded by
-- design: the node can only reply or hand off to a human — the same
-- reply-or-handoff contract `generateReply`/HANDOFF_SENTINEL already
-- implements, reused as-is (no new AI infrastructure).
--
-- Two CHECK constraints need widening:
--   1. flow_nodes.node_type — added in 010_flows.sql, widened in
--      016_flow_media.sql — needs 'ai_agent' added to the allow-list
--      or PUT /api/flows/[id] 500s (23514) the moment a flow with an
--      ai_agent node is saved.
--   2. ai_usage_log.mode — added in 033_ai_reply_polish.sql — needs a
--      third value, 'flow_agent', so AI spend from flow nodes is
--      distinguishable in usage/cost tracking from the standalone
--      auto-reply bot's 'auto_reply' spend.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'collect_input',
    'condition',
    'set_tag',
    'ai_agent',
    'handoff',
    'http_fetch',
    'end'
  ));

ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_mode_check;

ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_mode_check
  CHECK (mode IN ('auto_reply', 'draft', 'flow_agent'));
