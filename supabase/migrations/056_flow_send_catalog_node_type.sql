-- ============================================================
-- 056_flow_send_catalog_node_type.sql — new `send_catalog` Flow node type
--
-- Step 4 of docs/catalog-cart-plan.md. Lets a Flow step send a
-- "View catalogue" message that opens the WhatsApp catalogue connected to
-- the number, then move on. Session-only (no Meta template review), same
-- track as `send_message`. The Automations step of the same name needs no
-- migration: `automations.trigger_type` and `automation_steps.step_type`
-- are free text.
--
-- flow_nodes.node_type — added in 010_flows.sql, widened in
-- 016_flow_media.sql, 045_ai_agent_node_type.sql,
-- 046_flow_send_template_node_type.sql, 047_flow_wait_followup.sql and
-- 048_flow_send_carousel_node_type.sql — needs 'send_catalog' added to the
-- allow-list or PUT /api/flows/[id] 500s (23514) the moment a flow with a
-- send_catalog node is saved.
--
-- No new table needed — the node's config (body, footer, next_node_key)
-- lives in flow_nodes.config JSONB, same as every other node type.
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
    'send_catalog',
    'wait_followup',
    'collect_input',
    'condition',
    'set_tag',
    'ai_agent',
    'handoff',
    'http_fetch',
    'end'
  ));
