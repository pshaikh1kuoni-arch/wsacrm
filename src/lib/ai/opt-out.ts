import type { SupabaseClient } from '@supabase/supabase-js'
import { engineSendText } from '@/lib/flows/meta-send'

/**
 * WhatsApp/SMS opt-out convention — STOP / UNSUBSCRIBE / QUIT are
 * reserved keywords that must be honored immediately and
 * deterministically, without waiting on an LLM round trip to interpret
 * the same request phrased differently. Checked before any AI call
 * runs, in both the standalone auto-reply bot (`auto-reply.ts`) and
 * Flows (`engine.ts`), so the exact same set governs everywhere.
 *
 * Natural-language equivalents ("please don't message me again") are
 * still caught by the model via `STOP_FOLLOWUPS_SENTINEL` — this is the
 * deterministic backstop, not the only detector.
 */
const OPT_OUT_KEYWORDS = new Set(['stop', 'unsubscribe', 'quit'])

export function isOptOutKeyword(text: string): boolean {
  return OPT_OUT_KEYWORDS.has(text.trim().toLowerCase())
}

/**
 * Record a follow-ups opt-out: set the durable `conversations.
 * ai_followups_disabled` flag (migration 050) and send the one
 * confirmation message, per WhatsApp opt-out best practice. Shared by
 * both callers that can detect this — the standalone auto-reply bot
 * and the Flows engine — so the flag, the wording, and the "never let
 * a failed send block the flag write" behavior can't drift apart
 * between them.
 *
 * Best-effort on the send: a failed confirmation must never stop the
 * flag from being set — that's the part that actually matters.
 */
export async function recordFollowupsOptOut(
  db: SupabaseClient,
  args: {
    accountId: string
    userId: string
    conversationId: string
    contactId: string
  },
): Promise<void> {
  await db
    .from('conversations')
    .update({ ai_followups_disabled: true })
    .eq('id', args.conversationId)
  try {
    await engineSendText({
      accountId: args.accountId,
      userId: args.userId,
      conversationId: args.conversationId,
      contactId: args.contactId,
      text: "Got it — we won't send any more automated follow-ups. Message us anytime if you need something.",
      aiGenerated: true,
    })
  } catch (err) {
    console.error(
      '[opt-out] confirmation send failed:',
      err instanceof Error ? err.message : err,
    )
  }
}
