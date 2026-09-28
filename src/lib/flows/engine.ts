/**
 * Flow runner.
 *
 * The single entry point `dispatchInboundToFlows` is called by the
 * WhatsApp webhook on every inbound message *for an account that has
 * opted into the Flows beta*. It decides whether the message belongs
 * to an active conversation flow (advance it) or matches the entry
 * trigger of an active flow (start a new run) — and reports back to
 * the webhook so the webhook knows whether to also fire automations.
 *
 * Architecture in a sentence: the runner walks the customer through
 * a DB-stored node graph, suspending only at nodes that need
 * customer input. Each tap or text reply wakes it back up.
 *
 * What lives here vs elsewhere:
 *   - Pure decision logic (which button matched, where to advance to,
 *     when to fallback) — here.
 *   - DB shape (table reads/writes) — here.
 *   - Meta API calls — `meta-send.ts` (engineSendInteractive*).
 *   - Policy resolution (reprompt vs handoff vs end) — `fallback.ts`.
 *   - Type definitions — `types.ts`.
 *
 * Concurrency model:
 *   - Idempotency on `meta_message_id`: the runner refuses to advance
 *     an active run twice for the same Meta message — protects against
 *     Meta's retries.
 *   - Optimistic UPDATE with `current_node_key` precondition: two
 *     simultaneous taps for the same run collide at the DB layer; the
 *     second is a no-op.
 *   - Partial unique index `idx_one_active_run_per_contact`: two
 *     simultaneous starts for the same contact collide; the second
 *     INSERT raises 23505 and the runner catches & exits.
 */

import { supabaseAdmin } from "./admin-client";
import {
  engineSendInteractiveButtons,
  engineSendInteractiveList,
  engineSendInteractiveCarousel,
  engineSendMedia,
  engineSendText,
} from "./meta-send";
// Reused as-is from the automations engine — same Meta template call,
// same `message_templates` table. Automations already reuses Flows'
// interactive senders the other way (see automations/meta-send.ts's
// header comment), so this cross-import follows existing precedent
// rather than duplicating the Meta template-send logic here.
import { engineSendTemplate } from "@/lib/automations/meta-send";
import { decideFallback, resolveFallbackPolicy } from "./fallback";
import { addContactTagAndDispatch } from "@/lib/contacts/tag-events";
import { removeContactTag } from "@/lib/contacts/tag-write";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { loadAiConfig } from "@/lib/ai/config";
import { buildConversationContext } from "@/lib/ai/context";
import { retrieveKnowledge } from "@/lib/ai/knowledge";
import { generateReply } from "@/lib/ai/generate";
import { buildSystemPrompt } from "@/lib/ai/defaults";
import { buildHandoffSummary } from "@/lib/ai/handoff";
import { logAiUsage } from "@/lib/ai/usage";
import { latestUserMessage } from "@/lib/ai/query";
import {
  type AiAgentNodeConfig,
  type CollectInputNodeConfig,
  type ConditionNodeConfig,
  type DispatchInboundInput,
  type DispatchInboundResult,
  type FlowNodeRow,
  type FlowPendingAction,
  type FlowPendingExecutionRow,
  type FlowRow,
  type FlowRunRow,
  type ParsedInbound,
  type SendButtonsNodeConfig,
  type SendListNodeConfig,
  type SendCarouselNodeConfig,
  type SendMediaNodeConfig,
  type SendMessageNodeConfig,
  type SendTemplateNodeConfig,
  type SetTagNodeConfig,
  type StartNodeConfig,
  type KeywordTriggerConfig,
  type WaitFollowupNodeConfig,
} from "./types";

// ============================================================
// Pure helpers — extracted so engine.test.ts can exercise them
// without a Supabase / Meta mock.
// ============================================================

/**
 * Given a node + the customer's reply_id, return the next_node_key
 * to advance to, or `null` if no option matches.
 */
export function matchReplyId(
  node: { node_type: string; config: Record<string, unknown> },
  reply_id: string,
): string | null {
  if (node.node_type === "send_buttons") {
    const cfg = node.config as unknown as SendButtonsNodeConfig;
    const hit = cfg.buttons?.find((b) => b.reply_id === reply_id);
    return hit?.next_node_key ?? null;
  }
  if (node.node_type === "send_list") {
    const cfg = node.config as unknown as SendListNodeConfig;
    for (const section of cfg.sections ?? []) {
      const hit = section.rows?.find((r) => r.reply_id === reply_id);
      if (hit) return hit.next_node_key;
    }
    return null;
  }
  if (node.node_type === "send_carousel") {
    const cfg = node.config as unknown as SendCarouselNodeConfig;
    const hit = cfg.cards?.find((c) => c.reply_id === reply_id);
    return hit?.next_node_key ?? null;
  }
  return null;
}

/**
 * Case-insensitive contains/exact match against a list of keywords.
 * Used by the trigger evaluator. Stable enough that the v3 builder
 * UI can preview matches by passing canned strings.
 */
export function matchesKeywordTrigger(
  text: string,
  cfg: KeywordTriggerConfig,
): boolean {
  if (!text || !cfg.keywords?.length) return false;
  const matchType = cfg.match_type ?? "contains";
  const haystack = cfg.case_sensitive ? text : text.toLowerCase();
  for (const raw of cfg.keywords) {
    if (!raw) continue;
    const needle = cfg.case_sensitive ? raw : raw.toLowerCase();
    if (matchType === "exact" ? haystack === needle : haystack.includes(needle)) {
      return true;
    }
  }
  return false;
}

/**
 * The strings an inbound message offers to a flow's *entry* trigger.
 *
 * Typed text offers itself. A button / list tap offers two: the visible
 * title — what the customer would have typed had the button not been
 * there — and the stable reply_id, because the automation engine's
 * `interactive_reply` trigger routes on the id, so an author moving a
 * menu into a flow reaches for the same value.
 *
 * Matching the id does mean a keyword that happens to be a substring of
 * an id can fire (ids are author-controlled slugs, defaulting to
 * `btn_1`). That is the same substring semantic keyword triggers
 * already have for typed text, and the alternative — ignoring the id —
 * silently breaks the author who keyed on it.
 */
export function entryTriggerTexts(message: ParsedInbound): string[] {
  if (message.kind === "text") return [message.text];
  return [...new Set([message.reply_title, message.reply_id])].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
}

/**
 * Nodes that advance to a next_node_key without waiting for input.
 *
 * `send_carousel` is dual-mode (see `SendCarouselNodeConfig` in
 * types.ts) — pass its `config` so this can tell which behaviour
 * applies; omitting it defaults to url-mode's classification (matches
 * `blankCarouselPayload()`'s default button_mode).
 */
export function isAutoAdvancing(
  node_type: string,
  config?: { button_mode?: string },
): boolean {
  if (node_type === "send_carousel") return config?.button_mode !== "quick_reply";
  return (
    node_type === "start" ||
    node_type === "send_message" ||
    node_type === "send_media" ||
    node_type === "send_template" ||
    node_type === "condition" ||
    node_type === "set_tag"
  );
}

/**
 * Nodes that send a prompt and suspend awaiting a customer reply.
 * `ai_agent` sends nothing itself (see its branch in
 * `advanceFromNodeKey`) — it suspends silently and only calls the LLM
 * once the customer's next message grounds the reply in something
 * they actually said, rather than firing on stale context the instant
 * the flow reaches it.
 */
export function isSuspending(
  node_type: string,
  config?: { button_mode?: string },
): boolean {
  if (node_type === "send_carousel") return config?.button_mode === "quick_reply";
  return (
    node_type === "ai_agent" ||
    node_type === "send_buttons" ||
    node_type === "send_list" ||
    node_type === "collect_input"
  );
}

/** Nodes that end the run. */
export function isTerminal(node_type: string): boolean {
  return node_type === "handoff" || node_type === "end";
}

/**
 * Nodes that suspend on a TIMER rather than purely on customer input —
 * neither of the other two categories fits: unlike `isAutoAdvancing`,
 * the run doesn't move on this request; unlike `isSuspending`, it
 * doesn't wait indefinitely for a reply — a `flow_pending_executions`
 * row races a reply against the clock, whichever comes first advances
 * the run (see `scheduleFollowup` / the cron's `resumeFlowPendingExecution`).
 */
export function isTimedSuspending(node_type: string): boolean {
  return node_type === "wait_followup";
}

/**
 * Evaluate a `condition` node's predicate against the current run
 * state. Exported pure for unit testing — the engine wraps it with a
 * DB lookup for `tag` / `contact_field` subjects.
 */
export function evaluateConditionPredicate(args: {
  operator: ConditionNodeConfig["operator"];
  /**
   * Resolved value of the subject. `undefined` means the subject is
   * absent (no var with that key / no such tag / contact field is
   * null). Pure function: caller does the DB lookup.
   */
  subjectValue: string | undefined;
  /** The configured comparison value, when applicable. */
  configValue: string | undefined;
}): boolean {
  switch (args.operator) {
    case "present":
      return args.subjectValue !== undefined && args.subjectValue !== "";
    case "absent":
      return args.subjectValue === undefined || args.subjectValue === "";
    case "equals":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue === (args.configValue ?? "");
    case "contains":
      if (args.subjectValue === undefined) return false;
      return args.subjectValue.includes(args.configValue ?? "");
  }
}

// ============================================================
// DB I/O — wrapped in tiny helpers so the dispatch flow stays
// readable. Errors surface as thrown — the entry point catches.
// ============================================================

type AdminClient = ReturnType<typeof supabaseAdmin>;

async function loadActiveRunForContact(
  db: AdminClient,
  accountId: string,
  contactId: string,
): Promise<FlowRunRow | null> {
  // The partial unique index `idx_one_active_run_per_contact` was
  // rebuilt in migration 017 over `(account_id, contact_id)` — so
  // "two active runs for one contact in one account" is impossible
  // by design. But a future migration glitch or manual SQL could
  // create one, and .maybeSingle() throws on >1 row — which would
  // kill dispatch for that contact's webhook entirely. .limit(1) is
  // forgiving: pick the newest, let the cron sweep clean up the
  // stale one.
  const { data, error } = await db
    .from("flow_runs")
    .select("*")
    .eq("account_id", accountId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("[flows] loadActiveRunForContact error:", error.message);
    return null;
  }
  const rows = (data as FlowRunRow[] | null) ?? [];
  return rows[0] ?? null;
}

async function loadFlow(
  db: AdminClient,
  flowId: string,
): Promise<FlowRow | null> {
  const { data, error } = await db
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .maybeSingle();
  if (error) {
    console.error("[flows] loadFlow error:", error.message);
    return null;
  }
  return (data as FlowRow | null) ?? null;
}

/**
 * Load every node of a flow in one round trip and key them by
 * `node_key`. The advance loop is then in-memory — a 5-node
 * auto-advancing chain costs one SELECT, not five.
 *
 * Returns an empty map on error so the caller can still dispatch
 * cleanly (every subsequent .get() returns undefined → the run
 * fails with node_not_found, same as the old per-node lookup).
 */
async function loadAllNodes(
  db: AdminClient,
  flowId: string,
): Promise<Map<string, FlowNodeRow>> {
  const { data, error } = await db
    .from("flow_nodes")
    .select("*")
    .eq("flow_id", flowId);
  if (error) {
    console.error("[flows] loadAllNodes error:", error.message);
    return new Map();
  }
  const map = new Map<string, FlowNodeRow>();
  for (const row of (data ?? []) as FlowNodeRow[]) {
    map.set(row.node_key, row);
  }
  return map;
}

async function logEvent(
  db: AdminClient,
  flowRunId: string,
  event_type:
    | "started"
    | "node_entered"
    | "message_sent"
    | "reply_received"
    | "fallback_fired"
    | "handoff"
    | "timeout"
    | "error"
    | "completed",
  node_key: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from("flow_run_events").insert({
    flow_run_id: flowRunId,
    event_type,
    node_key,
    payload,
  });
  if (error) {
    // Logging failure is non-fatal — surface but don't throw.
    console.error("[flows] logEvent error:", error.message);
  }
}

/**
 * Idempotency check — has a `reply_received` event with this Meta
 * message_id already been recorded for any of the contact's flow
 * runs? If yes, the inbound is a duplicate (Meta retry) and we
 * exit without re-advancing.
 *
 * Implementation note: scoped to runs belonging to this user/contact
 * so the lookup is cheap (the index on flow_run_events(flow_run_id,
 * event_type) plus the small set of runs per contact).
 */
async function isDuplicateInbound(
  db: AdminClient,
  accountId: string,
  contactId: string,
  metaMessageId: string,
): Promise<boolean> {
  // Fetch ALL run ids for this contact in this account (active +
  // historical). Bounded by how many flows the customer has been
  // through — small.
  const { data: runs } = await db
    .from("flow_runs")
    .select("id")
    .eq("account_id", accountId)
    .eq("contact_id", contactId);
  if (!runs?.length) return false;
  const runIds = runs.map((r) => (r as { id: string }).id);

  const { count } = await db
    .from("flow_run_events")
    .select("id", { count: "exact", head: true })
    .in("flow_run_id", runIds)
    .eq("event_type", "reply_received")
    .filter("payload->>meta_message_id", "eq", metaMessageId);
  return (count ?? 0) > 0;
}

/** Who currently has this conversation — used to gate whether a fresh
 *  keyword is even allowed to start a new flow run. */
export type ConversationOwnership = "human" | "ai" | "none";

/**
 * A human-assigned thread, or one the standalone AI auto-reply is
 * actively carrying, is already "owned" — a coincidental keyword match
 * must never silently hijack it into an unrelated flow. `ai_reply_count
 * > 0` (and not handed off) is the same signal `dispatchInboundToAiReply`
 * already uses to know the bot has been replying here; mirroring it lets
 * flows and the standalone bot agree on what "AI owns this" means.
 * `"none"` only when nobody has engaged yet — a brand new contact, or a
 * thread that's gone cold with no assignee — which is when a flow SHOULD
 * be free to start (e.g. the "new customer says hi" case).
 */
export function resolveConversationOwnership(conv: {
  assigned_agent_id: string | null;
  ai_autoreply_disabled: boolean;
  ai_reply_count: number;
}): ConversationOwnership {
  if (conv.assigned_agent_id) return "human";
  if (!conv.ai_autoreply_disabled && conv.ai_reply_count > 0) return "ai";
  return "none";
}

/**
 * Load the ownership signal for `findEntryFlow`'s gate. Fails toward
 * "human" (i.e. block the flow from starting) on a missing row or a DB
 * error — same direction `dispatchInboundToAiReply` takes when it can't
 * read the conversation (it silently declines to reply rather than
 * guessing). The conversation row always exists by the time the webhook
 * reaches flow dispatch, so this only bites on a genuine DB hiccup.
 */
async function loadConversationOwnership(
  db: AdminClient,
  conversationId: string,
): Promise<ConversationOwnership> {
  const { data, error } = await db
    .from("conversations")
    .select("assigned_agent_id, ai_autoreply_disabled, ai_reply_count")
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return "human";
  return resolveConversationOwnership(
    data as {
      assigned_agent_id: string | null;
      ai_autoreply_disabled: boolean;
      ai_reply_count: number;
    },
  );
}

async function findEntryFlow(
  db: AdminClient,
  accountId: string,
  message: ParsedInbound,
  isFirstInbound: boolean,
  ownership: ConversationOwnership,
): Promise<FlowRow | null> {
  // Someone (or the AI) already owns this conversation — a keyword
  // trigger doesn't get to hijack it into a new flow run. See
  // resolveConversationOwnership. isFirstInbound implies "none" in
  // practice (nothing could have engaged before the contact's first
  // message), so this never blocks the genuinely-new-contact case.
  if (ownership !== "none") return null;

  // A tap used to be rejected outright here, on the reasoning that
  // interactive replies are responses to existing prompts. That holds
  // only while a prompt is outstanding — and this function runs solely
  // when the contact has NO active run, so there is nothing the tap
  // could be answering. What it actually blocked was issue #490: an
  // *automation* sends the buttons, the customer taps one, and the flow
  // whose keyword matches that button never starts. Retyping the label
  // by hand worked, which is the tell — same words, different envelope.
  const candidates = entryTriggerTexts(message);

  // Pull all active flows for this account. Active set is bounded
  // (the builder discourages double-trigger overlap; partial index
  // makes the lookup index-supported).
  const { data: flows, error } = await db
    .from("flows")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error || !flows) return null;

  const typed = flows as FlowRow[];
  for (const flow of typed) {
    if (flow.trigger_type === "keyword") {
      const cfg = flow.trigger_config as KeywordTriggerConfig;
      if (candidates.some((text) => matchesKeywordTrigger(text, cfg))) {
        return flow;
      }
    } else if (flow.trigger_type === "first_inbound_message" && isFirstInbound) {
      // Also reachable by a tap now: a broadcast template with a
      // quick-reply button can genuinely be what prompts a contact's
      // first-ever inbound. The automations dispatcher has always
      // treated a tap that way (the webhook pushes
      // `first_inbound_message` regardless of envelope) — flows were
      // the inconsistent half.
      return flow;
    }
    // 'manual' triggers do not auto-start from inbound messages.
  }
  return null;
}

// ============================================================
// Node executors — each handles ONE node type. send_buttons and
// send_list also persist `last_prompt_message_id` so the inbox
// thread can quote the prompt the customer is replying to.
// ============================================================

async function sendButtonsAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendButtonsNodeConfig;
  // Every customer-visible string is interpolated against run.vars —
  // same treatment send_message / collect_input already get (#553).
  // `reply_id` is deliberately NOT interpolated: it is the routing key
  // matchReplyId compares the tapped button against, so it must reach
  // Meta byte-for-byte as authored. Interpolation can push a title past
  // Meta's 20-char cap; meta-api's validator throws a descriptive error
  // and the caller logs it — we never truncate silently.
  const { whatsapp_message_id } = await engineSendInteractiveButtons({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.text, run.vars),
    headerText: interpolateOptionalVars(cfg.header_text, run.vars),
    footerText: interpolateOptionalVars(cfg.footer_text, run.vars),
    buttons: cfg.buttons.map((b) => ({
      id: b.reply_id,
      title: interpolateVars(b.title, run.vars),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_buttons",
    whatsapp_message_id,
  });
  // Look up our internal message id so we can stash it on the run.
  // Cheap — indexed on `messages.message_id`.
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function sendListAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendListNodeConfig;
  // See sendButtonsAndSuspend — interpolate every visible string,
  // never the row `reply_id`.
  const { whatsapp_message_id } = await engineSendInteractiveList({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.text, run.vars),
    buttonLabel: interpolateVars(cfg.button_label, run.vars),
    headerText: interpolateOptionalVars(cfg.header_text, run.vars),
    footerText: interpolateOptionalVars(cfg.footer_text, run.vars),
    sections: cfg.sections.map((s) => ({
      title: interpolateOptionalVars(s.title, run.vars),
      rows: s.rows.map((r) => ({
        id: r.reply_id,
        title: interpolateVars(r.title, run.vars),
        description: interpolateOptionalVars(r.description, run.vars),
      })),
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_list",
    whatsapp_message_id,
  });
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

/**
 * Sends a quick-reply-mode carousel and suspends. Used by both the
 * initial send in `advanceFromNodeKey` and the reprompt path in
 * `handleReplyForActiveRun` — url-mode carousels never reach either,
 * since a url button tap fires no webhook to suspend/reprompt on (see
 * `SendCarouselNodeConfig`'s doc comment in types.ts).
 */
async function sendCarouselAndSuspend(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<{ outcome: "advanced"; node_key: string }> {
  const cfg = node.config as unknown as SendCarouselNodeConfig;
  const { whatsapp_message_id } = await engineSendInteractiveCarousel({
    accountId: run.account_id,
    userId: run.user_id,
    conversationId: run.conversation_id!,
    contactId: run.contact_id!,
    bodyText: interpolateVars(cfg.body, run.vars),
    buttonMode: cfg.button_mode,
    // reply_id is deliberately NOT interpolated — same reasoning as
    // sendButtonsAndSuspend's reply_id above: it's the routing key
    // matchReplyId compares the tap against.
    cards: cfg.cards.map((c) => ({
      headerType: c.header_type,
      headerUrl: c.header_url,
      bodyText: interpolateOptionalVars(c.body, run.vars),
      buttonLabel: interpolateVars(c.button_label, run.vars),
      buttonId: c.reply_id,
    })),
  });
  await logEvent(db, run.id, "message_sent", node.node_key, {
    node_type: "send_carousel",
    whatsapp_message_id,
  });
  const { data: msg } = await db
    .from("messages")
    .select("id")
    .eq("message_id", whatsapp_message_id)
    .maybeSingle();
  await db
    .from("flow_runs")
    .update({
      last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
    })
    .eq("id", run.id);
  return { outcome: "advanced", node_key: node.node_key };
}

async function executeHandoff(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
): Promise<void> {
  const cfg = node.config as { assign_to?: string; note?: string };
  const convUpdate: Record<string, unknown> = {
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (cfg.assign_to) convUpdate.assigned_agent_id = cfg.assign_to;
  if (run.conversation_id) {
    await db
      .from("conversations")
      .update(convUpdate)
      .eq("id", run.conversation_id);
  }
  await logEvent(db, run.id, "handoff", node.node_key, {
    note: cfg.note ?? null,
    assigned_to: cfg.assign_to ?? null,
  });
  await endRun(db, run.id, "handed_off", "handoff_node");
}

/**
 * The `ai_agent` node's handoff path — reached when AI isn't
 * configured for the account, the account hit its AI rate limit, or
 * the model itself decided it can't help (the same reply-or-handoff
 * contract `generateReply`/`HANDOFF_SENTINEL` already implements for
 * the standalone auto-reply bot). Mirrors `executeHandoff` above,
 * routing to the account's configured "Hand off to" queue
 * (`assignTo`, from `loadAiConfig().handoffAgentId`) rather than a
 * per-node assignee — an `ai_agent` node has no assignee field of its
 * own by design.
 */
async function executeAiAgentHandoff(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
  reason: string,
  assignTo?: string | null,
  note?: string,
): Promise<void> {
  const convUpdate: Record<string, unknown> = {
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (assignTo) convUpdate.assigned_agent_id = assignTo;
  if (run.conversation_id) {
    await db
      .from("conversations")
      .update(convUpdate)
      .eq("id", run.conversation_id);
  }
  await logEvent(db, run.id, "handoff", node.node_key, {
    note: note ?? null,
    reason,
    assigned_to: assignTo ?? null,
  });
  await endRun(db, run.id, "handed_off", reason);
}

type AiAgentGenResult =
  | { ok: true; text: string }
  | { ok: false; reason: "ai_not_configured" | "ai_rate_limited" }
  | {
      ok: false;
      reason: "ai_agent_handoff";
      assignTo?: string | null;
      note?: string;
    };

/**
 * Shared AI-generation path for the `ai_agent` node — used both for a
 * live turn (the customer just spoke) and for the "stay in charge"
 * follow-up (the customer went quiet). Same account config, same
 * node prompt, same reply-or-handoff contract; `mode` only decides
 * whether a synthetic nudge turn gets appended so the model writes a
 * fresh re-engagement message instead of continuing its last reply
 * (the transcript otherwise ends on our own `assistant` turn, which
 * isn't a valid "generate the next message" prompt on its own).
 */
async function generateAiAgentMessage(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
  mode: "reply" | "followup",
): Promise<AiAgentGenResult> {
  const cfg = node.config as unknown as AiAgentNodeConfig;
  const aiConfig = await loadAiConfig(db, run.account_id);
  if (!aiConfig) return { ok: false, reason: "ai_not_configured" };
  const acctLimit = checkRateLimit(
    `ai-autoreply:${run.account_id}`,
    RATE_LIMITS.aiAutoReplyAccount,
  );
  if (!acctLimit.success) return { ok: false, reason: "ai_rate_limited" };

  const messages = await buildConversationContext(db, run.conversation_id!);
  if (mode === "followup") {
    messages.push({
      role: "user",
      content:
        "[System note: the customer has gone quiet for a while. First check the last thing they said. If they already gave a clear plan, timeline, or promise to come back (for example \"I'll order tomorrow\"), do not ask them again or push them — just warmly acknowledge their plan and let them know you're ready whenever they are. Only ask a real check-in question (e.g. whether they're still interested) if the conversation ended with no such plan. Keep it short and natural. Do not mention that this note exists or that you are automated.]",
    });
  }
  const knowledge =
    cfg.use_knowledge_base === false
      ? undefined
      : await retrieveKnowledge(
          db,
          run.account_id,
          aiConfig,
          latestUserMessage(messages),
        );
  const systemPrompt = buildSystemPrompt({
    userPrompt: [aiConfig.systemPrompt, cfg.prompt]
      .filter((s): s is string => Boolean(s && s.trim()))
      .join("\n\n"),
    mode: "auto_reply",
    knowledge,
  });
  const { text, handoff, usage } = await generateReply({
    config: aiConfig,
    systemPrompt,
    messages,
  });
  void logAiUsage(db, {
    accountId: run.account_id,
    conversationId: run.conversation_id!,
    mode: "flow_agent",
    provider: aiConfig.provider,
    model: aiConfig.model,
    usage,
  });
  if (handoff || !text) {
    return {
      ok: false,
      reason: "ai_agent_handoff",
      assignTo: aiConfig.handoffAgentId,
      note: buildHandoffSummary({ messages, replyCount: 0 }),
    };
  }
  return { ok: true, text };
}

/**
 * The `ai_agent` node's actual turn — called from
 * `handleReplyForActiveRun` once the customer has replied to whatever
 * came before it (the node itself only suspends when the run first
 * reaches it, see the `ai_agent` branch in `advanceFromNodeKey`), so
 * `buildConversationContext` below always includes what they just
 * said as the latest turn.
 *
 * Reuses the account's already-configured AI (Settings → AI — same
 * provider/key/knowledge base as the standalone auto-reply bot and
 * the Inbox "Draft with AI" button) and the same bounded reply-or-
 * handoff contract `generateReply`/HANDOFF_SENTINEL already
 * implements. On a successful reply, continues the flow from the
 * node's `next_node_key` via `advanceFromNodeKey` — an AI reply is
 * just one more auto-advancing step once it lands.
 */
async function runAiAgentTurn(
  db: AdminClient,
  run: FlowRunRow,
  node: FlowNodeRow,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  const cfg = node.config as unknown as AiAgentNodeConfig;
  // A reply always means "they're back" — clear any scheduled
  // re-engage callback from a previous turn's "stay in charge" wait
  // before doing anything else, whether this turn ends in a reply,
  // a handoff, or an error. Safe no-op when nothing is pending.
  await cancelPendingExecutions(db, run.id);
  try {
    const result = await generateAiAgentMessage(db, run, node, "reply");
    if (!result.ok) {
      if (result.reason === "ai_agent_handoff") {
        await executeAiAgentHandoff(
          db,
          run,
          node,
          result.reason,
          result.assignTo,
          result.note,
        );
      } else {
        await executeAiAgentHandoff(db, run, node, result.reason);
      }
      return { consumed: true, flow_run_id: run.id, outcome: "handed_off" };
    }
    const { whatsapp_message_id } = await engineSendText({
      accountId: run.account_id,
      userId: run.user_id,
      conversationId: run.conversation_id!,
      contactId: run.contact_id!,
      text: result.text,
      aiGenerated: true,
    });
    await logEvent(db, run.id, "message_sent", node.node_key, {
      node_type: "ai_agent",
      whatsapp_message_id,
    });
  } catch (err) {
    await logEvent(db, run.id, "error", node.node_key, {
      reason: "ai_agent_failed",
      detail: err instanceof Error ? err.message : String(err),
    });
    await endRun(db, run.id, "failed", "ai_agent_failed");
    return { consumed: true, flow_run_id: run.id, outcome: "completed" };
  }

  if (cfg.followup_wait_minutes && cfg.followup_wait_minutes > 0) {
    // "Stay in charge": don't advance yet. current_node_key is
    // already parked on this ai_agent node (it's been here since the
    // first reply), so there's nothing to move — just schedule the
    // re-engage callback. A reply before it fires re-enters this
    // function (cancelling the callback above); silence instead lets
    // the cron call `generateAiAgentMessage` again in "followup" mode
    // via `resumeFlowPendingExecution`, so the nudge is AI-written
    // from the real conversation, not a fixed string.
    try {
      await scheduleFollowup(
        db,
        run,
        node.node_key,
        {
          kind: "ai_reengage",
          next_node_key: cfg.next_node_key,
        },
        cfg.followup_wait_minutes,
      );
    } catch (err) {
      await logEvent(db, run.id, "error", node.node_key, {
        reason: "ai_agent_followup_schedule_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      await endRun(db, run.id, "failed", "ai_agent_followup_schedule_failed");
      return { consumed: true, flow_run_id: run.id, outcome: "completed" };
    }
    return { consumed: true, flow_run_id: run.id, outcome: "advanced" };
  }

  const outcome = await advanceFromNodeKey(db, run, cfg.next_node_key, nodes);
  return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
}

/**
 * Resolve a condition node's subject value from DB / run state, then
 * call the pure `evaluateConditionPredicate`. Splits out so the
 * predicate itself stays unit-testable without a Supabase mock.
 *
 * Subject sources:
 *   - `var` → `flow_runs.vars[subject_key]` (captured by collect_input
 *     or http_fetch in v2).
 *   - `tag` → present iff `contact_tags(contact_id, tag_id)` exists.
 *     `subject_key` IS the tag UUID; the SELECT returns 1 row or 0.
 *   - `contact_field` → one of name/email/phone/company on `contacts`.
 */
async function evaluateConditionNode(
  db: AdminClient,
  run: FlowRunRow,
  cfg: ConditionNodeConfig,
): Promise<boolean> {
  let subjectValue: string | undefined;
  if (cfg.subject === "var") {
    const v = run.vars[cfg.subject_key];
    subjectValue = typeof v === "string" ? v : v === undefined ? undefined : String(v);
  } else if (cfg.subject === "tag") {
    const { count } = await db
      .from("contact_tags")
      .select("contact_id", { count: "exact", head: true })
      .eq("contact_id", run.contact_id!)
      .eq("tag_id", cfg.subject_key);
    // For tags, "present" really is the only meaningful test — the
    // `present`/`absent` operators are the natural fit. equals/contains
    // against a tag UUID would still work mechanically (compare its
    // existence to the value).
    subjectValue = (count ?? 0) > 0 ? cfg.subject_key : undefined;
  } else {
    const ALLOWED = ["name", "email", "phone", "company"] as const;
    type AllowedField = (typeof ALLOWED)[number];
    if (!ALLOWED.includes(cfg.subject_key as AllowedField)) {
      throw new Error(`unsupported contact_field: ${cfg.subject_key}`);
    }
    const { data } = await db
      .from("contacts")
      .select(cfg.subject_key)
      .eq("id", run.contact_id!)
      .maybeSingle();
    const raw = (data as Record<string, unknown> | null)?.[cfg.subject_key];
    subjectValue = typeof raw === "string" && raw.length > 0 ? raw : undefined;
  }
  return evaluateConditionPredicate({
    operator: cfg.operator,
    subjectValue,
    configValue: cfg.value,
  });
}

/**
 * Tiny `{{vars.foo}}` interpolation. Used by send_message + collect_input
 * prompt text so a captured `name` can show up in the next prompt
 * ("Thanks {{vars.name}}, what's your email?"). Missing vars render as
 * empty string — the same behavior as the automations engine.
 */
function interpolateVars(template: string, vars: Record<string, unknown>): string {
  if (!template) return "";
  return template.replace(/\{\{vars\.([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * `interpolateVars` for optional config fields (header_text, footer_text,
 * list section titles, row descriptions). An absent field stays absent
 * — `interpolateVars(undefined)` would return "" and meta-api treats
 * header/footer/description by truthiness, so "" is harmless there, but
 * keeping `undefined` means the payload we log and send matches what
 * the author configured rather than sprouting empty strings.
 */
function interpolateOptionalVars(
  template: string | undefined,
  vars: Record<string, unknown>,
): string | undefined {
  return template === undefined || template === null
    ? undefined
    : interpolateVars(template, vars);
}

async function endRun(
  db: AdminClient,
  runId: string,
  status: "completed" | "handed_off" | "timed_out" | "failed",
  reason: string,
): Promise<void> {
  await db
    .from("flow_runs")
    .update({
      status,
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", runId);
}

// ============================================================
// The synchronous advance loop. Walks through auto-advance nodes
// until it hits one that suspends (send_buttons/send_list) or
// terminates (handoff/end). Each suspending node persists the
// new current_node_key before returning.
// ============================================================

async function advanceFromNodeKey(
  db: AdminClient,
  run: FlowRunRow,
  startNodeKey: string,
  nodes: Map<string, FlowNodeRow>,
): Promise<{ outcome: "advanced" | "completed" | "handed_off" }> {
  let currentKey: string | null = startNodeKey;
  // Defensive cap — if a flow has a cycle (which the validator
  // SHOULD catch but doesn't yet in v1), we bail rather than loop.
  for (let safety = 0; safety < 64; safety += 1) {
    if (!currentKey) {
      await logEvent(db, run.id, "error", null, {
        reason: "next_node_key was null mid-advance",
      });
      await endRun(db, run.id, "failed", "missing_next_node");
      return { outcome: "completed" };
    }
    const node: FlowNodeRow | null = nodes.get(currentKey) ?? null;
    if (!node) {
      await logEvent(db, run.id, "error", currentKey, {
        reason: "node_not_found",
      });
      await endRun(db, run.id, "failed", "node_not_found");
      return { outcome: "completed" };
    }
    await logEvent(db, run.id, "node_entered", node.node_key, {
      node_type: node.node_type,
    });

    if (node.node_type === "start") {
      currentKey = (node.config as unknown as StartNodeConfig).next_node_key;
      continue;
    }
    if (node.node_type === "send_message") {
      const cfg = node.config as unknown as SendMessageNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendText({
          accountId: run.account_id,
    userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.text, run.vars),
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_message",
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_text_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_text_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_media") {
      const cfg = node.config as unknown as SendMediaNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendMedia({
          accountId: run.account_id,
    userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          kind: cfg.media_type,
          link: cfg.media_url,
          caption: cfg.caption
            ? interpolateVars(cfg.caption, run.vars)
            : undefined,
          filename: cfg.filename,
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_media",
          media_type: cfg.media_type,
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_media_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_media_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "send_template") {
      const cfg = node.config as unknown as SendTemplateNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendTemplate({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          templateName: cfg.template_name,
          language: cfg.language,
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "send_template",
          whatsapp_message_id,
        });
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_template_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_template_failed");
        return { outcome: "completed" };
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "wait_followup") {
      const cfg = node.config as unknown as WaitFollowupNodeConfig;
      try {
        await scheduleFollowup(
          db,
          run,
          node.node_key,
          {
            kind: "followup_message",
            text: cfg.followup_text,
            next_node_key: cfg.next_node_key,
          },
          cfg.wait_minutes,
        );
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "wait_followup_schedule_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "wait_followup_schedule_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "collect_input") {
      // Send the prompt and suspend. Customer's next TEXT reply will
      // wake us up via handleReplyForActiveRun's collect_input branch.
      const cfg = node.config as unknown as CollectInputNodeConfig;
      try {
        const { whatsapp_message_id } = await engineSendText({
          accountId: run.account_id,
    userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
        await logEvent(db, run.id, "message_sent", node.node_key, {
          node_type: "collect_input",
          whatsapp_message_id,
        });
        const { data: msg } = await db
          .from("messages")
          .select("id")
          .eq("message_id", whatsapp_message_id)
          .maybeSingle();
        await db
          .from("flow_runs")
          .update({
            last_prompt_message_id: (msg as { id: string } | null)?.id ?? null,
          })
          .eq("id", run.id);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "collect_input_prompt_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "collect_input_prompt_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "condition") {
      const cfg = node.config as unknown as ConditionNodeConfig;
      let branch: "true" | "false";
      try {
        branch = (await evaluateConditionNode(db, run, cfg))
          ? "true"
          : "false";
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "condition_evaluation_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "condition_evaluation_failed");
        return { outcome: "completed" };
      }
      currentKey =
        branch === "true" ? cfg.true_next : cfg.false_next;
      await logEvent(db, run.id, "node_entered", node.node_key, {
        condition_result: branch,
        advancing_to: currentKey,
      });
      continue;
    }
    if (node.node_type === "set_tag") {
      const cfg = node.config as unknown as SetTagNodeConfig;
      try {
        if (cfg.mode === "add") {
          await addContactTagAndDispatch({
            db,
            accountId: run.account_id,
            contactId: run.contact_id!,
            tagId: cfg.tag_id,
            context: {
              conversation_id: run.conversation_id ?? undefined,
              vars: run.vars,
            },
          });
        } else {
          await removeContactTag(db, {
            accountId: run.account_id,
            contactId: run.contact_id!,
            tagId: cfg.tag_id,
          });
        }
      } catch (err) {
        // Non-fatal — log + advance. A tag-write failure shouldn't
        // strand the customer mid-flow.
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "set_tag_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
      currentKey = cfg.next_node_key;
      continue;
    }
    if (node.node_type === "ai_agent") {
      // Suspend only — deliberately does NOT call the LLM here. Firing
      // immediately (the way set_tag/send_message auto-advance) meant
      // the model answered using whatever was already in the
      // conversation, one full turn before the customer had actually
      // said anything new at this point in the flow — it would reply
      // to a question they hadn't asked yet (issue found in testing:
      // a "Classic Mug" button tap → price message → the AI agent
      // immediately also answered a discount/payment question that
      // came from EARLIER in the thread). Parking here and running the
      // LLM only when the customer's next message arrives —
      // `runAiAgentTurn`, called from `handleReplyForActiveRun` below
      // — means the reply is always grounded in what they just said.
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_buttons") {
      // Same failure contract as send_message / send_media /
      // collect_input above: log + fail the run. Previously an
      // exception here (Meta error, or meta-api's length validation —
      // now reachable via interpolation, see sendButtonsAndSuspend)
      // escaped to dispatchInboundToFlows' catch, which only
      // console.error'd and left the run active + stuck on the prior
      // node with nothing in flow_run_events.
      try {
        await sendButtonsAndSuspend(db, run, node);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_buttons_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_buttons_failed");
        return { outcome: "completed" };
      }
      // Persist the new current_node_key via optimistic UPDATE.
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_list") {
      try {
        await sendListAndSuspend(db, run, node);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_list_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_list_failed");
        return { outcome: "completed" };
      }
      const advanced = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advanced) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "send_carousel") {
      const cfg = node.config as unknown as SendCarouselNodeConfig;
      if (cfg.button_mode !== "quick_reply") {
        // url mode — a card's button opens a link client-side; Meta
        // never sends a webhook for that tap, so fire and auto-advance,
        // same shape as send_media/send_template above.
        try {
          const { whatsapp_message_id } = await engineSendInteractiveCarousel({
            accountId: run.account_id,
            userId: run.user_id,
            conversationId: run.conversation_id!,
            contactId: run.contact_id!,
            bodyText: interpolateVars(cfg.body, run.vars),
            buttonMode: "url",
            cards: cfg.cards.map((c) => ({
              headerType: c.header_type,
              headerUrl: c.header_url,
              bodyText: interpolateOptionalVars(c.body, run.vars),
              buttonLabel: interpolateVars(c.button_label, run.vars),
              buttonUrl: c.button_url,
            })),
          });
          await logEvent(db, run.id, "message_sent", node.node_key, {
            node_type: "send_carousel",
            whatsapp_message_id,
          });
        } catch (err) {
          await logEvent(db, run.id, "error", node.node_key, {
            reason: "send_carousel_failed",
            detail: err instanceof Error ? err.message : String(err),
          });
          await endRun(db, run.id, "failed", "send_carousel_failed");
          return { outcome: "completed" };
        }
        currentKey = cfg.next_node_key ?? null;
        continue;
      }
      // quick_reply mode — send and suspend, same shape as
      // send_buttons/send_list above.
      try {
        await sendCarouselAndSuspend(db, run, node);
      } catch (err) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "send_carousel_failed",
          detail: err instanceof Error ? err.message : String(err),
        });
        await endRun(db, run.id, "failed", "send_carousel_failed");
        return { outcome: "completed" };
      }
      const advancedCarousel = await advanceCurrentNodeKey(
        db,
        run.id,
        run.current_node_key,
        node.node_key,
      );
      if (!advancedCarousel) {
        await logEvent(db, run.id, "error", node.node_key, {
          reason: "lost_race_during_advance",
        });
      }
      return { outcome: "advanced" };
    }
    if (node.node_type === "handoff") {
      await executeHandoff(db, run, node);
      return { outcome: "handed_off" };
    }
    if (node.node_type === "end") {
      await logEvent(db, run.id, "completed", node.node_key);
      await endRun(db, run.id, "completed", "end_node");
      return { outcome: "completed" };
    }
    // Unknown node type — shouldn't happen given the CHECK constraint.
    await logEvent(db, run.id, "error", node.node_key, {
      reason: `unknown_node_type:${node.node_type}`,
    });
    await endRun(db, run.id, "failed", "unknown_node_type");
    return { outcome: "completed" };
  }
  // Safety break — log + fail.
  await logEvent(db, run.id, "error", currentKey, {
    reason: "advance_loop_safety_break",
  });
  await endRun(db, run.id, "failed", "advance_loop_overflow");
  return { outcome: "completed" };
}

/**
 * Optimistic UPDATE — only advance current_node_key when it matches
 * the value we read at the top of dispatch. If another webhook beat
 * us, the row's pointer has already moved and our UPDATE returns
 * zero rows; we treat that as a no-op and let the other run continue.
 */
async function advanceCurrentNodeKey(
  db: AdminClient,
  runId: string,
  expectedOldKey: string | null,
  newKey: string,
): Promise<boolean> {
  // PostgREST: when expectedOldKey is null we can't `.eq` (would match
  // any row); use `.is('current_node_key', null)` instead.
  let q = db
    .from("flow_runs")
    .update({
      current_node_key: newKey,
      last_advanced_at: new Date().toISOString(),
    })
    .eq("id", runId)
    .eq("status", "active");
  if (expectedOldKey === null) {
    q = q.is("current_node_key", null);
  } else {
    q = q.eq("current_node_key", expectedOldKey);
  }
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[flows] advanceCurrentNodeKey error:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

// ============================================================
// Timed-resume mechanism — shared by `wait_followup` (and, later, the
// `ai_agent` "stay in context" option). A `flow_pending_executions`
// row races a reply against a clock: `cancelPendingExecutions` is
// called from the reply path the instant the customer answers back;
// `resumeFlowPendingExecution` is called by the cron
// (`/api/flows/cron`) when the clock wins instead.
// ============================================================

async function scheduleFollowup(
  db: AdminClient,
  run: FlowRunRow,
  nodeKey: string,
  action: FlowPendingAction,
  waitMinutes: number,
): Promise<void> {
  const runAt = new Date(Date.now() + waitMinutes * 60 * 1000).toISOString();
  const { error } = await db.from("flow_pending_executions").insert({
    flow_run_id: run.id,
    account_id: run.account_id,
    node_key: nodeKey,
    action,
    run_at: runAt,
    status: "pending",
  });
  if (error) throw new Error(`schedule_followup_failed: ${error.message}`);
}

/**
 * Cancel any outstanding scheduled callback for a run. Called the
 * instant a reply lands on a node that has one pending (currently
 * only `wait_followup`) — the customer answering back means the
 * scheduled nudge is moot, whichever fires first should be the only
 * one that fires.
 */
async function cancelPendingExecutions(
  db: AdminClient,
  runId: string,
): Promise<void> {
  await db
    .from("flow_pending_executions")
    .update({ status: "cancelled" })
    .eq("flow_run_id", runId)
    .eq("status", "pending");
}

async function markPendingExecution(
  db: AdminClient,
  id: string,
  status: "done" | "cancelled" | "failed",
): Promise<void> {
  await db.from("flow_pending_executions").update({ status }).eq("id", id);
}

/**
 * Cron entry point (`/api/flows/cron`) for a due `flow_pending_executions`
 * row. Re-checks the run is still active AND still parked at the exact
 * node the row was scheduled from before acting — the cheapest possible
 * defense against the race where a reply arrives in the gap between
 * "row became due" and "cron actually gets to it": if the run already
 * moved on, this is a stale callback and gets cancelled rather than
 * firing a follow-up on a topic the customer has already left behind.
 */
export async function resumeFlowPendingExecution(
  row: FlowPendingExecutionRow,
): Promise<void> {
  const db = supabaseAdmin();
  const { data: runData } = await db
    .from("flow_runs")
    .select("*")
    .eq("id", row.flow_run_id)
    .maybeSingle();
  const run = (runData as FlowRunRow | null) ?? null;
  if (!run || run.status !== "active" || run.current_node_key !== row.node_key) {
    await markPendingExecution(db, row.id, "cancelled");
    return;
  }

  const nodes = await loadAllNodes(db, run.flow_id);

  if (row.action.kind === "followup_message") {
    try {
      const { whatsapp_message_id } = await engineSendText({
        accountId: run.account_id,
        userId: run.user_id,
        conversationId: run.conversation_id!,
        contactId: run.contact_id!,
        text: interpolateVars(row.action.text, run.vars),
      });
      await logEvent(db, run.id, "message_sent", row.node_key, {
        node_type: "wait_followup",
        reason: "followup_sent",
        whatsapp_message_id,
      });
    } catch (err) {
      await logEvent(db, run.id, "error", row.node_key, {
        reason: "wait_followup_send_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      await endRun(db, run.id, "failed", "wait_followup_send_failed");
      await markPendingExecution(db, row.id, "failed");
      return;
    }
    await advanceFromNodeKey(db, run, row.action.next_node_key, nodes);
    await markPendingExecution(db, row.id, "done");
  } else if (row.action.kind === "ai_reengage") {
    const action = row.action;
    const node = nodes.get(row.node_key);
    try {
      if (node) {
        const result = await generateAiAgentMessage(db, run, node, "followup");
        if (!result.ok) {
          if (result.reason === "ai_agent_handoff") {
            await executeAiAgentHandoff(
              db,
              run,
              node,
              result.reason,
              result.assignTo,
              result.note,
            );
          } else {
            await executeAiAgentHandoff(db, run, node, result.reason);
          }
          await markPendingExecution(db, row.id, "done");
          return;
        }
        const { whatsapp_message_id } = await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: result.text,
          aiGenerated: true,
        });
        await logEvent(db, run.id, "message_sent", row.node_key, {
          node_type: "ai_agent",
          reason: "followup_sent",
          whatsapp_message_id,
        });
      }
    } catch (err) {
      await logEvent(db, run.id, "error", row.node_key, {
        reason: "ai_agent_followup_send_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      await endRun(db, run.id, "failed", "ai_agent_followup_send_failed");
      await markPendingExecution(db, row.id, "failed");
      return;
    }
    await advanceFromNodeKey(db, run, action.next_node_key, nodes);
    await markPendingExecution(db, row.id, "done");
  }
}

// ============================================================
// Public entry point — the webhook calls this on every inbound.
// ============================================================

export async function dispatchInboundToFlows(
  input: DispatchInboundInput & { isFirstInboundMessage: boolean },
): Promise<DispatchInboundResult> {
  const db = supabaseAdmin();
  try {
    const activeRun = await loadActiveRunForContact(
      db,
      input.accountId,
      input.contactId,
    );

    // Idempotency — only matters if there's already a run for this
    // contact. For new runs, the partial unique index catches duplicate
    // starts at INSERT time.
    if (activeRun) {
      const dupe = await isDuplicateInbound(
        db,
        input.accountId,
        input.contactId,
        input.message.meta_message_id,
      );
      if (dupe) {
        return {
          consumed: true,
          flow_run_id: activeRun.id,
          outcome: "duplicate_inbound_ignored",
        };
      }
      // One SELECT for the whole flow's nodes — advance loop is now
      // in-memory. See loadAllNodes.
      const nodes = await loadAllNodes(db, activeRun.flow_id);
      return handleReplyForActiveRun(db, activeRun, input.message, nodes);
    }

    // No active run → look for a flow whose entry trigger matches, but
    // only if nobody already owns this conversation (see
    // resolveConversationOwnership).
    const ownership = await loadConversationOwnership(
      db,
      input.conversationId,
    );
    const flow = await findEntryFlow(
      db,
      input.accountId,
      input.message,
      input.isFirstInboundMessage,
      ownership,
    );
    if (!flow || !flow.entry_node_id) {
      return { consumed: false, outcome: "no_match" };
    }
    const nodes = await loadAllNodes(db, flow.id);
    return startNewRun(db, flow, input, nodes);
  } catch (err) {
    console.error(
      "[flows] dispatchInboundToFlows threw:",
      err instanceof Error ? err.message : err,
    );
    return { consumed: false, outcome: "no_match" };
  }
}

async function handleReplyForActiveRun(
  db: AdminClient,
  run: FlowRunRow,
  message: ParsedInbound,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // Note: we intentionally do NOT persist the raw customer text. A
  // `collect_input` prompt that asks "what's your card number?" would
  // otherwise leave the PAN sitting in flow_run_events.payload forever,
  // visible to anyone with access to the runs viewer or the events
  // table. Length is enough for "did they actually reply?" debugging;
  // for the captured value itself, the `node_entered` event already
  // records `captured_key` + `captured_length` after the var is stored.
  await logEvent(db, run.id, "reply_received", run.current_node_key, {
    meta_message_id: message.meta_message_id,
    reply_kind: message.kind,
    reply_id: message.kind === "interactive_reply" ? message.reply_id : null,
    text_length: message.kind === "text" ? message.text.length : null,
  });

  if (!run.current_node_key) {
    // Defensive — a run with status='active' but no current node is
    // malformed. Fail the run rather than spin.
    await endRun(db, run.id, "failed", "active_run_missing_current_node");
    return {
      consumed: true,
      flow_run_id: run.id,
      outcome: "no_match",
    };
  }

  const currentNode = nodes.get(run.current_node_key) ?? null;
  if (!currentNode) {
    await endRun(db, run.id, "failed", "current_node_not_found");
    return { consumed: true, flow_run_id: run.id, outcome: "no_match" };
  }

  // ai_agent takes over here rather than joining the matched-reply
  // logic below — any reply (button tap or free text) is valid input
  // for the model to react to, there's no "didn't match, fall back"
  // case the way send_buttons/collect_input have.
  if (currentNode.node_type === "ai_agent") {
    return await runAiAgentTurn(db, run, currentNode, nodes);
  }

  // wait_followup also takes over here — any reply means "they're
  // back," full stop. It doesn't try to interpret what they said
  // (that's a downstream node's job); it just cancels the scheduled
  // follow-up so the cron doesn't also fire, and advances.
  if (currentNode.node_type === "wait_followup") {
    await cancelPendingExecutions(db, run.id);
    const cfg = currentNode.config as unknown as WaitFollowupNodeConfig;
    const outcome = await advanceFromNodeKey(db, run, cfg.next_node_key, nodes);
    return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
  }

  // Two ways a reply can advance:
  //   1. Interactive button/list/carousel-card tap on a
  //      send_buttons/send_list/send_carousel node. A url-mode
  //      carousel is never the current node here in the first place —
  //      it auto-advances past itself in advanceFromNodeKey, so this
  //      branch only ever sees a quick_reply-mode carousel.
  //   2. Text reply on a collect_input node — capture into vars.
  //
  // Everything else falls through to the fallback policy below.
  let matched: string | null = null;
  if (
    message.kind === "interactive_reply" &&
    (currentNode.node_type === "send_buttons" ||
      currentNode.node_type === "send_list" ||
      currentNode.node_type === "send_carousel")
  ) {
    matched = matchReplyId(currentNode, message.reply_id);
  } else if (
    message.kind === "text" &&
    currentNode.node_type === "collect_input"
  ) {
    const cfg = currentNode.config as unknown as CollectInputNodeConfig;
    const captured = message.text.trim();
    if (captured.length > 0 && cfg.var_key) {
      // Persist captured value + reset reprompt count atomically.
      const newVars = { ...run.vars, [cfg.var_key]: captured };
      const { error: capErr } = await db
        .from("flow_runs")
        .update({
          vars: newVars,
          reprompt_count: 0,
        })
        .eq("id", run.id);
      if (!capErr) {
        // Mirror the UPDATE in-memory so downstream interpolation in
        // the advance loop sees the captured var without us having to
        // re-SELECT the whole row.
        run.vars = newVars;
        run.reprompt_count = 0;
        await logEvent(db, run.id, "node_entered", currentNode.node_key, {
          captured_key: cfg.var_key,
          captured_length: captured.length,
        });
        matched = cfg.next_node_key;
      }
    }
  }

  if (matched) {
    // Reset reprompt count on a successful match. Skip the write when
    // already 0 — the collect_input capture branch above already
    // zeroed it, and interactive-reply matches against a fresh run
    // (post-prior-reset) are also already 0. The previous re-read of
    // the whole row was needed only because we weren't mirroring the
    // capture UPDATE into the in-memory `run`; now that we do, the
    // local copy is the source of truth.
    if (run.reprompt_count !== 0) {
      const { error } = await db
        .from("flow_runs")
        .update({ reprompt_count: 0 })
        .eq("id", run.id);
      if (!error) run.reprompt_count = 0;
    }
    const outcome = await advanceFromNodeKey(db, run, matched, nodes);
    return {
      consumed: true,
      flow_run_id: run.id,
      outcome: outcome.outcome,
    };
  }

  // No match → fallback. Apply the policy.
  const policy = resolveFallbackPolicy(
    (await loadFlow(db, run.flow_id))?.fallback_policy,
  );
  const newReprompts = run.reprompt_count + 1;
  await db
    .from("flow_runs")
    .update({ reprompt_count: newReprompts })
    .eq("id", run.id);

  const action = decideFallback({ policy, reprompt_count: newReprompts });
  await logEvent(db, run.id, "fallback_fired", run.current_node_key, {
    action: action.type,
    reprompt_count: newReprompts,
  });
  if (action.type === "ignore") {
    // Don't consume — let automations have a shot at it.
    return { consumed: false, flow_run_id: run.id, outcome: "no_match" };
  }
  if (action.type === "reprompt") {
    // Re-send the same prompt. Same node, no current_node_key change.
    // The interactive helpers interpolate run.vars themselves, so a
    // reprompt renders the same text the original prompt did. A send
    // failure here is logged but does not end the run — the customer
    // still has the original prompt on screen and can retry.
    try {
      if (currentNode.node_type === "send_buttons") {
        await sendButtonsAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "send_list") {
        await sendListAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "send_carousel") {
        await sendCarouselAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "collect_input") {
        // Customer typed something we couldn't accept (empty after trim,
        // or var_key missing — rare). Re-send the prompt so they try again.
        const cfg = currentNode.config as unknown as CollectInputNodeConfig;
        await engineSendText({
          accountId: run.account_id,
          userId: run.user_id,
          conversationId: run.conversation_id!,
          contactId: run.contact_id!,
          text: interpolateVars(cfg.prompt_text, run.vars),
        });
      }
    } catch (err) {
      await logEvent(db, run.id, "error", currentNode.node_key, {
        reason: "reprompt_send_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    return { consumed: true, flow_run_id: run.id, outcome: "fallback_fired" };
  }
  if (action.type === "handoff") {
    if (run.conversation_id) {
      await db
        .from("conversations")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", run.conversation_id);
    }
    await logEvent(db, run.id, "handoff", run.current_node_key, {
      reason: "fallback_exhausted",
    });
    await endRun(db, run.id, "handed_off", "fallback_exhausted");
    return { consumed: true, flow_run_id: run.id, outcome: "handed_off" };
  }
  // action.type === 'end'
  await endRun(db, run.id, "completed", "fallback_exhausted_end");
  return { consumed: true, flow_run_id: run.id, outcome: "completed" };
}

async function startNewRun(
  db: AdminClient,
  flow: FlowRow,
  input: DispatchInboundInput,
  nodes: Map<string, FlowNodeRow>,
): Promise<DispatchInboundResult> {
  // INSERT — partial unique index `idx_one_active_run_per_contact`
  // catches concurrent inserts with 23505. We catch and return as
  // consumed:true (the parallel webhook handles it).
  const { data: inserted, error: insErr } = await db
    .from("flow_runs")
    .insert({
      flow_id: flow.id,
      // Tenancy: NOT NULL post-017. The partial unique index
      // `idx_one_active_run_per_contact` is over (account_id,
      // contact_id) WHERE status='active', so two accounts sharing
      // a contact phone number each run their own flows independently.
      account_id: flow.account_id,
      // Audit: preserves the flow's author on the run row for log
      // attribution.
      user_id: flow.user_id,
      contact_id: input.contactId,
      conversation_id: input.conversationId,
      status: "active",
      current_node_key: flow.entry_node_id,
    })
    .select("*")
    .maybeSingle();
  if (insErr) {
    // 23505 = unique_violation → another webhook is starting the run.
    const msg = insErr.message ?? "";
    if (msg.includes("23505") || msg.includes("duplicate key")) {
      return { consumed: true, outcome: "duplicate_inbound_ignored" };
    }
    console.error("[flows] startNewRun insert error:", insErr.message);
    return { consumed: false, outcome: "no_match" };
  }
  const run = inserted as FlowRunRow;
  await logEvent(db, run.id, "started", flow.entry_node_id, {
    flow_id: flow.id,
    trigger_type: flow.trigger_type,
    meta_message_id: input.message.meta_message_id,
  });
  // Bump the flow's execution counter — used by the builder UI to
  // surface "X runs since activation" on the flow card.
  //
  // Atomic RPC (migration 012) rather than read-modify-write: two
  // concurrent webhooks starting runs for different contacts on the
  // same flow would otherwise both read N and both write N+1, losing
  // a count. Mirrors the automations engine's use of
  // `increment_automation_execution_count` (migration 007).
  const { error: incErr } = await db.rpc("increment_flow_execution_count", {
    p_flow_id: flow.id,
  });
  if (incErr) {
    // Non-fatal — the run itself succeeded; only the counter is off.
    console.error("[flows] execution_count rpc error:", incErr.message);
  }

  // Run the advance loop starting from the entry node.
  const outcome = await advanceFromNodeKey(db, run, flow.entry_node_id!, nodes);
  return {
    consumed: true,
    flow_run_id: run.id,
    outcome: outcome.outcome === "advanced" ? "started" : outcome.outcome,
  };
}
