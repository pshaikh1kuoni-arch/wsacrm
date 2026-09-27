-- ============================================================
-- 047_flow_wait_followup.sql — new `wait_followup` Flow node type
--
-- Lets a Flow step pause for up to 23 hours waiting on the customer's
-- next reply; if none arrives, it sends a follow-up message and
-- continues. Needed because a Flow run that goes quiet is otherwise
-- silently marked `timed_out` by the existing stale-run sweep
-- (src/app/api/flows/cron/route.ts) with no message sent and no
-- trace the next trigger can see — the customer's next message just
-- starts a brand-new run from scratch, with no memory of where they
-- left off.
--
-- `flow_pending_executions` is the scheduling table this node (and,
-- later, a "stay in context" option on `ai_agent`) uses to park a
-- timed callback. Modeled on `automation_pending_executions`
-- (006_automations.sql) but simplified: Flows track progress as one
-- scalar (`flow_runs.current_node_key`), not a step-tree position, so
-- resuming only needs the run id + the node it was parked at.
--
-- flow_nodes.node_type — added in 010_flows.sql, widened in
-- 016_flow_media.sql, 045_ai_agent_node_type.sql, and
-- 046_flow_send_template_node_type.sql — needs 'wait_followup' added
-- to the allow-list or PUT /api/flows/[id] 500s (23514) the moment a
-- flow with a wait_followup node is saved.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS flow_pending_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  -- Tenancy — mirrors automation_pending_executions' account_id (added
  -- there in 017_account_sharing.sql); added here from the start since
  -- flow_runs is already account-scoped.
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Node the run was parked at when this row was scheduled. The cron
  -- re-checks flow_runs.current_node_key still equals this before
  -- acting — defends against a customer reply that snuck in during
  -- the race between "timer due" and "cron actually runs".
  node_key TEXT NOT NULL,
  -- What to do when the timer fires. Discriminated by `kind`:
  --   { kind: 'followup_message', text, next_node_key }
  -- A future 'ai_reengage' kind (part of the ai_agent "stay in
  -- context" option) will reuse this same column and cron path.
  action JSONB NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  -- 'running' is the cron's optimistic claim lock (flips pending →
  -- running via a conditional UPDATE before acting) — same pattern as
  -- automation_pending_executions.status.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'cancelled', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cron's due-row scan.
CREATE INDEX IF NOT EXISTS idx_flow_pending_due
  ON flow_pending_executions(run_at) WHERE status = 'pending';

-- Cancel-on-reply lookup (handleReplyForActiveRun clears any
-- outstanding pending row for the run before processing the reply).
CREATE INDEX IF NOT EXISTS idx_flow_pending_run
  ON flow_pending_executions(flow_run_id) WHERE status = 'pending';

ALTER TABLE flow_pending_executions ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — service-role only, same as
-- automation_pending_executions. The engine and cron are the only
-- readers/writers; nothing in the builder UI queries this table.

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
    'wait_followup',
    'collect_input',
    'condition',
    'set_tag',
    'ai_agent',
    'handoff',
    'http_fetch',
    'end'
  ));
