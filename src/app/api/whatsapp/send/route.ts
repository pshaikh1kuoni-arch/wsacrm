import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  sendMessageToConversation,
  validateSendMessageParams,
  SendMessageError,
} from '@/lib/whatsapp/send-message'
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import { CONVERSATION_SELECT, normalizeConversation } from '@/lib/inbox/conversations'
import type { Conversation } from '@/types'

// The dashboard's outbound-send endpoint. It owns auth, per-user rate
// limiting, and the three ways the UI targets a thread — an existing
// `conversation_id` (inbox), a `contact_id` (Contact detail →
// find-or-create the conversation), or a raw `phone` (Inbox "quick
// send" → find-or-create the CONTACT too, so a number never seen
// before doesn't need a manually-created contact first). The actual
// Meta plumbing (validate → send → persist → pause flows) lives in the
// shared `sendMessageToConversation` core, which the public
// `/api/v1/messages` endpoint reuses. This route is a thin adapter:
// resolve the conversation, delegate, then map `SendMessageError` back
// onto the dashboard's internal `{ error }` shape.
export async function POST(request: Request) {
  try {
    // Requires the 'agent' role, matching both `canSendMessages` and the
    // `messages_modify` RLS policy (migration 017).
    //
    // Resolving `account_id` off the profile — which any 'viewer' has —
    // was previously the only gate. RLS did block the message INSERT, but
    // the send core calls Meta BEFORE it persists, so a viewer's request
    // still delivered a real WhatsApp message to the customer and merely
    // failed to record it (surfacing as "sent to Meta but failed to save
    // to DB"). RLS can't un-send that, so the role check belongs here.
    const { supabase, accountId, userId } = await requireRole('agent')

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${userId}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      // `conversation_id` targets an existing thread (inbox). `contact_id`
      // lets a caller initiate from a contact that may have no conversation
      // yet (Contact detail → Send template) — we find-or-create one below.
      // `phone` goes one step further (Inbox "quick send"): the contact
      // itself may not exist yet either.
      conversation_id: conversationIdInput,
      contact_id,
      phone,
      message_type,
      content_text,
      media_url,
      filename,
      template_name,
      template_language,
      template_params,
      template_message_params,
      interactive_payload,
      reply_to_message_id,
    } = body

    if ((!conversationIdInput && !contact_id && !phone) || !message_type) {
      return NextResponse.json(
        {
          error:
            'Either conversation_id, contact_id, or phone, plus message_type, are required',
        },
        { status: 400 }
      )
    }

    // Validate the message shape up front — before the contact_id path
    // finds-or-creates a conversation — so an invalid payload 400s
    // without leaving an orphan empty conversation behind.
    try {
      validateSendMessageParams({
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        templateName: template_name,
        interactivePayload: interactive_payload,
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    // Resolve the target conversation. With `conversation_id` we load the
    // existing thread; with `contact_id` we find-or-create one for the
    // contact so a business-initiated template send (Contact detail view)
    // reuses the shared send core below; with `phone` we find-or-create
    // the CONTACT first (quick send), then fall into the same
    // find-or-create-conversation step.
    let conversationId: string | null = null
    // Only the phone path needs the full conversation (with its contact
    // embedded) back in the response — the other two callers already
    // have it. Set below only when that path runs.
    let embedConversation = false

    if (conversationIdInput) {
      const { data, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationIdInput)
        .eq('account_id', accountId)
        .single()

      if (convError || !data) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }
      conversationId = data.id
    } else if (contact_id) {
      // contact_id path: verify the contact is in this account first so a
      // caller can't open a conversation against someone else's contact.
      const { data: contactRow, error: contactErr } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', contact_id)
        .eq('account_id', accountId)
        .maybeSingle()

      if (contactErr || !contactRow) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }

      const resolved = await findOrCreateConversation(
        supabase,
        accountId,
        userId,
        contact_id
      )
      if (!resolved) {
        return NextResponse.json(
          { error: 'Failed to open a conversation for this contact' },
          { status: 500 }
        )
      }
      conversationId = resolved
    } else {
      // phone path (Inbox quick send): the leading `+` is required so the
      // country code is explicit — same boundary rule as the manual
      // "Add Contact" form and the public API (issue #586).
      const sanitizedPhone = parseInternationalPhone(phone)
      if (!sanitizedPhone) {
        return NextResponse.json(
          {
            error:
              "'phone' must be an international phone number with a leading + and country code (e.g. +14155550123)",
          },
          { status: 400 }
        )
      }

      const resolvedContactId = await findOrCreateContactByPhone(
        supabase,
        accountId,
        userId,
        sanitizedPhone
      )
      if (!resolvedContactId) {
        return NextResponse.json(
          { error: 'Failed to create contact for this number' },
          { status: 500 }
        )
      }

      const resolved = await findOrCreateConversation(
        supabase,
        accountId,
        userId,
        resolvedContactId
      )
      if (!resolved) {
        return NextResponse.json(
          { error: 'Failed to open a conversation for this contact' },
          { status: 500 }
        )
      }
      conversationId = resolved
      embedConversation = true
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Delegate to the shared send core (validates, sends to Meta with
    // phone-variant retry, persists, pauses active flow runs). Its
    // `SendMessageError` carries a machine code + HTTP status; the
    // dashboard maps it to the internal `{ error }` shape.
    //
    // Known trade-off (phone path only): if this call fails, the contact
    // created just above is not rolled back — it's a real, validated
    // phone number and orphaning it here is no worse than the existing
    // contact_id path already orphaning an empty conversation on
    // failure. No transactional rollback exists anywhere else in this
    // codebase either, so this stays consistent rather than adding
    // one-off cleanup logic.
    try {
      const result = await sendMessageToConversation(supabase, accountId, {
        conversationId,
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        filename,
        templateName: template_name,
        templateLanguage: template_language,
        templateParams: template_params,
        templateMessageParams: template_message_params,
        interactivePayload: interactive_payload,
        replyToMessageId: reply_to_message_id,
      })

      // Quick send needs the full conversation (with its contact) back
      // so the Inbox can select it without a second round trip — the
      // other two callers already have it client-side.
      let conversation: Conversation | undefined
      if (embedConversation) {
        const { data: convRow } = await supabase
          .from('conversations')
          .select(CONVERSATION_SELECT)
          .eq('id', conversationId)
          .single()
        if (convRow) {
          conversation = normalizeConversation(convRow as Conversation)
        }
      }

      return NextResponse.json({
        success: true,
        message_id: result.messageId,
        whatsapp_message_id: result.whatsappMessageId,
        ...(conversation ? { conversation } : {}),
      })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status }
        )
      }
      throw err
    }
  } catch (error) {
    // requireRole throws Unauthorized/Forbidden; toErrorResponse maps
    // those to 401/403 and collapses anything else to a generic 500.
    console.error('Error in WhatsApp send POST:', error)
    return toErrorResponse(error)
  }
}

type SendSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Return the contact's conversation id in this account, creating one if
 * it doesn't exist yet. Mirrors the webhook's find-or-create so an
 * inbound-then-outbound (or outbound-first) sequence converges on a single
 * thread per contact. Runs under the caller's RLS — the conversations_insert
 * policy requires account agent membership, which the caller already is.
 *
 * Ordered oldest-first and takes one row rather than `.maybeSingle()`,
 * which throws on ≥2 rows — if duplicates predate the unique index
 * (migration 036_conversation_contact_dedup.sql), this resolves to the
 * canonical survivor instead of erroring the send. The insert has the
 * same unique-violation race backstop as `findOrCreateContactByPhone`
 * below: two concurrent sends to a contact with no conversation yet
 * (e.g. a double-clicked quick send) can both pass the initial lookup
 * and race on the insert.
 */
async function findOrCreateConversation(
  supabase: SendSupabase,
  accountId: string,
  userId: string,
  contactId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (existing && existing.length > 0) return existing[0].id

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: userId,
      contact_id: contactId,
    })
    .select('id')
    .single()

  if (error || !created) {
    if (isUniqueViolation(error)) {
      const { data: raced } = await supabase
        .from('conversations')
        .select('id')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })
        .limit(1)
      if (raced && raced.length > 0) return raced[0].id
    }
    console.error('Error creating conversation for contact send:', error?.message)
    return null
  }

  return created.id
}

/**
 * Find-or-create a contact by phone for the quick-send path — the
 * dashboard equivalent of `findOrCreateContact` in
 * `@/lib/api/v1/contacts`, reusing the same `findExistingContact`
 * dedupe + unique-violation race backstop. Deliberately NOT that
 * function directly: it attributes created rows to the account's
 * WhatsApp config owner (correct for the no-session public API and
 * the inbound webhook), whereas a quick send has a real signed-in
 * agent — the created contact should show that agent as its owner,
 * matching the manual "Add Contact" form's `user_id: user.id`
 * convention. `phone` here is already the sanitized (leading-`+`
 * stripped) digits form from `parseInternationalPhone`. Name is left
 * `null` — deliberately, so the contact renders as its phone number
 * until someone fills in a name (every render site already falls back
 * to phone), unlike the public API / webhook which default `name` to
 * the phone digits.
 */
async function findOrCreateContactByPhone(
  supabase: SendSupabase,
  accountId: string,
  userId: string,
  phone: string,
): Promise<string | null> {
  const existing = await findExistingContact(supabase, accountId, phone)
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: userId,
      phone,
      name: null,
    })
    .select('id')
    .single()

  if (error || !created) {
    // Lost a race against a concurrent create — the unique index
    // (migration 022) rejected the duplicate. Re-resolve to the winner.
    if (isUniqueViolation(error)) {
      const raced = await findExistingContact(supabase, accountId, phone)
      if (raced) return raced.id
    }
    console.error('Error creating contact for quick send:', error?.message)
    return null
  }

  return created.id
}
