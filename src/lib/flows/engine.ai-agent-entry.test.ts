import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================
// Regression coverage for the "AI Agent answers the very first
// message" fix. Two things must both hold:
//
//   1. A run that reaches `ai_agent` straight from `start` — nothing
//      auto-sent ahead of it — replies immediately, on the message
//      that triggered the run. No second inbound required.
//   2. A run that reaches `ai_agent` AFTER something else was already
//      auto-sent earlier in the same advance chain (the shape the
//      original "suspend only" rule was protecting) still parks and
//      waits for the customer's next word — unchanged.
//
// Self-contained fake DB (separate from engine.test.ts's shared fixture,
// which never exercises a fresh `startNewRun` — its active-run fixture
// has no INSERT-then-mutate tracking for `flow_runs`). This one tracks
// a single mutable `flow_runs` row so `advanceCurrentNodeKey`'s
// optimistic-concurrency read-after-insert works like the real thing.
// ============================================================

interface ConversationFake {
  assigned_agent_id: string | null;
  ai_followups_disabled?: boolean;
}

const h = vi.hoisted(() => ({
  state: {
    flows: [] as unknown[],
    nodes: [] as unknown[],
    /** The one `flow_runs` row this suite ever has — null until
     *  `startNewRun` inserts it, then mutated in place by every
     *  subsequent UPDATE, mirroring a real single-row table. */
    run: null as Record<string, unknown> | null,
    conversation: { assigned_agent_id: null } as ConversationFake,
    events: [] as Record<string, unknown>[],
  },
}));

vi.mock("./admin-client", () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      is: () => b,
      in: () => b,
      filter: () => b,
      order: () => b,
      limit: () => b,
      update: (row: Record<string, unknown>) => {
        if (table === "flow_runs" && h.state.run) {
          Object.assign(h.state.run, row);
        }
        return b;
      },
      insert: (row: Record<string, unknown>) => {
        if (table === "flow_runs") {
          h.state.run = {
            id: "run-1",
            vars: {},
            reprompt_count: 0,
            current_node_key: null,
            ...row,
          };
        }
        if (table === "flow_run_events") h.state.events.push(row);
        return b;
      },
      maybeSingle: async () => {
        if (table === "flow_runs") return { data: h.state.run, error: null };
        if (table === "flows") {
          return { data: (h.state.flows[0] as unknown) ?? null, error: null };
        }
        if (table === "conversations") {
          return { data: h.state.conversation, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({
        data: (table === "flows" ? h.state.flows[0] : null) ?? null,
        error: null,
      }),
      then: (
        resolve: (r: {
          data: unknown[];
          error: null;
          count: number;
        }) => unknown,
      ) => {
        if (table === "flow_runs") {
          return resolve({
            data: h.state.run ? [h.state.run] : [],
            error: null,
            count: 0,
          });
        }
        if (table === "flows") {
          return resolve({ data: h.state.flows, error: null, count: 0 });
        }
        if (table === "flow_nodes") {
          return resolve({ data: h.state.nodes, error: null, count: 0 });
        }
        return resolve({ data: [], error: null, count: 0 });
      },
    };
    return b;
  }

  return {
    supabaseAdmin: () => ({
      from: (t: string) => builder(t),
      rpc: () => Promise.resolve({ error: null, data: null }),
    }),
  };
});

const engineSendText = vi.fn(async () => ({ whatsapp_message_id: "wamid.1" }));

vi.mock("./meta-send", () => ({
  engineSendText: (...a: unknown[]) =>
    (engineSendText as unknown as (...x: unknown[]) => unknown)(...a),
  engineSendMedia: vi.fn(async () => ({ whatsapp_message_id: "wamid.2" })),
  engineSendInteractiveButtons: vi.fn(async () => ({
    whatsapp_message_id: "wamid.3",
  })),
  engineSendInteractiveList: vi.fn(async () => ({
    whatsapp_message_id: "wamid.4",
  })),
  engineSendInteractiveCarousel: vi.fn(async () => ({
    whatsapp_message_id: "wamid.5",
  })),
}));

vi.mock("@/lib/automations/meta-send", () => ({
  engineSendTemplate: vi.fn(async () => ({ whatsapp_message_id: "wamid.6" })),
}));

const loadAiConfig = vi.fn();
vi.mock("@/lib/ai/config", () => ({
  loadAiConfig: (...a: unknown[]) =>
    (loadAiConfig as unknown as (...x: unknown[]) => unknown)(...a),
}));

vi.mock("@/lib/ai/context", () => ({
  buildConversationContext: vi.fn(async () => [
    { role: "user", content: "Apart from the mug, what else do you sell?" },
  ]),
}));

vi.mock("@/lib/ai/knowledge", () => ({
  retrieveKnowledge: vi.fn(async () => []),
}));

const generateReply = vi.fn();
vi.mock("@/lib/ai/generate", () => ({
  generateReply: (...a: unknown[]) =>
    (generateReply as unknown as (...x: unknown[]) => unknown)(...a),
}));

import { dispatchInboundToFlows, resumeFlowPendingExecution } from "./engine";
import type { FlowPendingExecutionRow, ParsedInbound } from "./types";

const ANY_MESSAGE_FLOW = {
  id: "flow-1",
  account_id: "acct-1",
  user_id: "u-1",
  status: "active",
  trigger_type: "any_message",
  trigger_config: {},
  entry_node_id: "start",
  created_at: "2026-01-01T00:00:00Z",
};

const AGENT_NODE = {
  id: "n-agent",
  flow_id: "flow-1",
  node_key: "agent",
  node_type: "ai_agent",
  config: { prompt: "Help the customer.", next_node_key: "done" },
};

const DONE_NODE = {
  id: "n-done",
  flow_id: "flow-1",
  node_key: "done",
  node_type: "end",
  config: {},
};

function dispatch(message: ParsedInbound) {
  return dispatchInboundToFlows({
    accountId: "acct-1",
    userId: "u-1",
    contactId: "ct-1",
    conversationId: "cv-1",
    message,
    isFirstInboundMessage: false,
  });
}

function text(t: string): ParsedInbound {
  return { kind: "text", text: t, meta_message_id: `m-${t}` };
}

const AI_CONFIG = {
  provider: "openai" as const,
  model: "gpt-5.4-mini",
  apiKey: "sk-test",
  systemPrompt: "You sell customized gifts.",
  isActive: true,
  autoReplyEnabled: true,
  autoReplyMaxPerConversation: 3,
  handoffAgentId: null,
  embeddingsApiKey: null,
};

beforeEach(() => {
  h.state.run = null;
  h.state.events = [];
  h.state.conversation = { assigned_agent_id: null };
  engineSendText.mockClear();
  loadAiConfig.mockReset().mockResolvedValue(AI_CONFIG);
  generateReply.mockReset();
});

describe("ai_agent as the flow's very first node", () => {
  beforeEach(() => {
    h.state.flows = [ANY_MESSAGE_FLOW];
    h.state.nodes = [
      {
        id: "n-start",
        flow_id: "flow-1",
        node_key: "start",
        node_type: "start",
        config: { next_node_key: "agent" },
      },
      AGENT_NODE,
      DONE_NODE,
    ];
  });

  it("replies immediately to the triggering message — no second inbound needed", async () => {
    generateReply.mockResolvedValue({
      text: "We also do keychains, frames, and cushions!",
      handoff: false,
      usage: null,
    });

    const result = await dispatch(
      text("Apart from the mug, what else do you sell?"),
    );

    expect(result.consumed).toBe(true);
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "We also do keychains, frames, and cushions!",
      }),
    );
    expect(h.state.events).toContainEqual(
      expect.objectContaining({
        event_type: "message_sent",
        node_key: "agent",
      }),
    );
  });
});

describe("ai_agent reached after an earlier auto-send in the same chain", () => {
  beforeEach(() => {
    h.state.flows = [ANY_MESSAGE_FLOW];
    h.state.nodes = [
      {
        id: "n-start",
        flow_id: "flow-1",
        node_key: "start",
        node_type: "start",
        config: { next_node_key: "price" },
      },
      {
        id: "n-price",
        flow_id: "flow-1",
        node_key: "price",
        node_type: "send_message",
        config: { text: "Classic Mug available at 300 INR", next_node_key: "agent" },
      },
      AGENT_NODE,
      DONE_NODE,
    ];
  });

  it("still parks without calling the model — the original stale-context guard", async () => {
    const result = await dispatch(text("Classic Mug"));

    expect(result.consumed).toBe(true);
    // Only the auto-sent price message went out — the AI never ran.
    expect(engineSendText).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Classic Mug available at 300 INR" }),
    );
    expect(generateReply).not.toHaveBeenCalled();
    // Run is parked at the agent node, waiting for the customer's next word.
    expect(h.state.run).toMatchObject({ current_node_key: "agent", status: "active" });
  });
});

describe("a wait_followup reminder firing into ai_agent (the real Chat AI All Msg shape)", () => {
  // Mirrors the user's actual flow: an ai_agent node's wait_followup
  // reminder fires on a timer (cron → resumeFlowPendingExecution), then
  // routes straight into a second ai_agent node. The reminder itself is
  // NOT a customer message — the second ai_agent must not mistake it
  // for one and reply to its own reminder. The reminder's own content
  // is now AI-generated (context-aware), not the literal fixed string.
  beforeEach(() => {
    h.state.nodes = [AGENT_NODE];
    h.state.run = {
      id: "run-1",
      flow_id: "flow-1",
      account_id: "acct-1",
      user_id: "u-1",
      contact_id: "ct-1",
      conversation_id: "cv-1",
      status: "active",
      current_node_key: "wait",
      vars: {},
      reprompt_count: 0,
    };
  });

  function pendingRow(): FlowPendingExecutionRow {
    return {
      id: "pend-1",
      flow_run_id: "run-1",
      account_id: "acct-1",
      node_key: "wait",
      action: {
        kind: "followup_message",
        text: "Still there? Let us know if you'd like to go ahead.",
        next_node_key: "agent",
      },
      run_at: "2026-01-01T00:05:00Z",
      status: "pending",
      created_at: "2026-01-01T00:00:00Z",
    };
  }

  it("sends an AI-generated reminder, grounded in the node's typed-in intent — the second ai_agent never runs on its own reminder", async () => {
    generateReply.mockResolvedValue({
      text: "Just checking in — still keen to go ahead with the order?",
      handoff: false,
      stopFollowups: false,
      usage: null,
    });

    await resumeFlowPendingExecution(pendingRow());

    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Just checking in — still keen to go ahead with the order?",
      }),
    );
    // The reminder landed, but that's OUR message, not the customer's —
    // the second ai_agent node must still be waiting for them, not
    // replying to what we just said.
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(h.state.run).toMatchObject({ current_node_key: "agent", status: "active" });
  });

  it("sends the stop-followups confirmation and ends the run when the customer already asked to stop", async () => {
    generateReply.mockResolvedValue({
      text: "",
      handoff: false,
      stopFollowups: true,
      usage: null,
    });

    await resumeFlowPendingExecution(pendingRow());

    expect(engineSendText).toHaveBeenCalledTimes(1);
    expect(engineSendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("won't send any more automated follow-ups"),
      }),
    );
    expect(h.state.run).toMatchObject({
      status: "completed",
      end_reason: "customer_opted_out",
    });
  });

  it("never fires when the contact has already opted out of follow-ups", async () => {
    h.state.conversation = { assigned_agent_id: null, ai_followups_disabled: true };

    await resumeFlowPendingExecution(pendingRow());

    expect(generateReply).not.toHaveBeenCalled();
    expect(engineSendText).not.toHaveBeenCalled();
    expect(h.state.run).toMatchObject({
      status: "completed",
      end_reason: "followups_disabled",
    });
  });
});

describe("the deterministic opt-out keyword", () => {
  beforeEach(() => {
    h.state.flows = [ANY_MESSAGE_FLOW];
    h.state.nodes = [
      {
        id: "n-start",
        flow_id: "flow-1",
        node_key: "start",
        node_type: "start",
        config: { next_node_key: "agent" },
      },
      AGENT_NODE,
      DONE_NODE,
    ];
  });

  it.each(["stop", "STOP", "Unsubscribe", "quit"])(
    "sets the flag and sends a confirmation for %j, without calling the model",
    async (word) => {
      const result = await dispatch(text(word));

      expect(result).toEqual({ consumed: true, outcome: "opted_out" });
      expect(generateReply).not.toHaveBeenCalled();
      expect(engineSendText).toHaveBeenCalledTimes(1);
      expect(engineSendText).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("won't send any more automated follow-ups"),
        }),
      );
    },
  );

  it("does not trip on a message that merely contains the word", async () => {
    generateReply.mockResolvedValue({
      text: "Sure, here are all our products!",
      handoff: false,
      stopFollowups: false,
      usage: null,
    });

    const result = await dispatch(text("please stop sending me the wrong size"));

    expect(result.outcome).not.toBe("opted_out");
    // Falls through to the normal flow — the flow itself decides what
    // to do with the message; the deterministic gate only fires on the
    // bare keyword, matching the WhatsApp/SMS opt-out convention.
  });
});
