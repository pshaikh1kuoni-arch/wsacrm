-- ============================================================
-- 048_flow_send_carousel_node_type.sql — new `send_carousel` Flow node type
--
-- Lets a Flow step send an interactive carousel — 2-10 swipeable media
-- cards, each with its own header/text/button. Session-only (no Meta
-- template review), same track as `send_buttons`/`send_list`. See
-- docs/carousel-messages-plan.md for the full design, including the
-- dual button_mode behaviour ('url' auto-advances like send_media;
-- 'quick_reply' suspends and routes per-card like send_buttons).
--
-- flow_nodes.node_type — added in 010_flows.sql, widened in
-- 016_flow_media.sql, 045_ai_agent_node_type.sql,
-- 046_flow_send_template_node_type.sql, and 047_flow_wait_followup.sql
-- — needs 'send_carousel' added to the allow-list or
-- PUT /api/flows/[id] 500s (23514) the moment a flow with a
-- send_carousel node is saved.
--
-- No new table needed — a carousel node's config (body, button_mode,
-- cards[]) lives entirely in flow_nodes.config JSONB, same as every
-- other node type.
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
    'send_carousel',
    'send_message',
    'send_media',
    'send_template',
    'wait_followup',
    'collect_input',
    'condition',
    'set_tag',
    'ai_agent',
    'handoff',
    'http_fetch',
    'end'
  ));
