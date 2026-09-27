-- ============================================================
-- 046_flow_send_template_node_type.sql — new `send_template` Flow node type
--
-- Lets a Flow step send an approved WhatsApp template message — the
-- same capability Automations already has (`send_template` step type,
-- see src/lib/automations/engine.ts), now available inside a Flow's
-- conversation graph. Needed for any Flow that re-engages a customer
-- outside Meta's 24-hour customer-service window, where a normal
-- message is rejected and only a template is allowed.
--
-- flow_nodes.node_type — added in 010_flows.sql, widened in
-- 016_flow_media.sql and 045_ai_agent_node_type.sql — needs
-- 'send_template' added to the allow-list or PUT /api/flows/[id]
-- 500s (23514) the moment a flow with a send_template node is saved.
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
    'send_template',
    'collect_input',
    'condition',
    'set_tag',
    'ai_agent',
    'handoff',
    'http_fetch',
    'end'
  ));
