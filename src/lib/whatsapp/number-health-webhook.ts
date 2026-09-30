/**
 * Handlers for Meta's number-health webhook events.
 *
 *   - phone_number_quality_update — quality rating / messaging limit moved
 *       value: { display_phone_number, event, current_limit }
 *   - account_update              — account-level events (verification,
 *       violations, restrictions)
 *       value: { phone_number?, event, ... }
 *
 * Both fields must be subscribed in Meta App Dashboard → WhatsApp →
 * Configuration → Webhooks (a one-time manual step, like the template
 * fields). `entry.id` is the WABA id.
 *
 * The webhook only says THAT something changed. The current rating and
 * limit are read back from the Graph API right after, so the stored
 * values never depend on how Meta words the event.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { onlyDigits } from './number-health'
import { refreshNumberHealth } from './number-health-sync'

const NUMBER_HEALTH_WEBHOOK_FIELDS = new Set([
  'phone_number_quality_update',
  'account_update',
])

export function isNumberHealthWebhookField(field: string): boolean {
  return NUMBER_HEALTH_WEBHOOK_FIELDS.has(field)
}

export interface NumberHealthWebhookChange {
  field: string
  value: unknown
  /** `entry.id` from the webhook envelope — the WABA id. */
  wabaId?: string
}

interface EventValue {
  event?: string
  display_phone_number?: string
  phone_number?: string
  current_limit?: string
  [key: string]: unknown
}

interface ConfigRow {
  account_id: string
  phone_number_id: string
  access_token: string
}

export async function handleNumberHealthWebhookChange(
  change: NumberHealthWebhookChange,
  supabase: SupabaseClient,
): Promise<void> {
  if (!isNumberHealthWebhookField(change.field)) return

  const value = (change.value ?? {}) as EventValue
  const metaEvent = typeof value.event === 'string' ? value.event : undefined
  const eventNumber = value.display_phone_number ?? value.phone_number
  const where = `${change.field} (${metaEvent ?? 'no event'}), WABA ${change.wabaId ?? 'unknown'}`

  if (!change.wabaId) {
    console.warn(`[number-health-webhook] ${where} — no WABA id, cannot resolve the account`)
    return
  }

  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('account_id, phone_number_id, access_token')
    .eq('waba_id', change.wabaId)
  if (error) {
    console.error(`[number-health-webhook] ${where} — config lookup failed:`, error.message)
    return
  }

  let targets = (data ?? []) as ConfigRow[]
  if (targets.length === 0) {
    console.warn(`[number-health-webhook] ${where} — no account uses this WABA`)
    return
  }

  // Several accounts on one WABA: attribute the event by the phone number
  // stored at the last sync. No match means we cannot say whose it is.
  if (targets.length > 1) {
    const wanted = onlyDigits(eventNumber)
    const { data: known } = await supabase
      .from('number_health')
      .select('account_id, display_phone_number')
      .in('account_id', targets.map((t) => t.account_id))
    const matched = new Set(
      ((known ?? []) as { account_id: string; display_phone_number: string | null }[])
        .filter((k) => wanted && onlyDigits(k.display_phone_number) === wanted)
        .map((k) => k.account_id),
    )
    targets = targets.filter((t) => matched.has(t.account_id))
    if (targets.length === 0) {
      console.warn(`[number-health-webhook] ${where} — several accounts share this WABA and none matches ${eventNumber ?? 'the event number'}`)
      return
    }
  }

  for (const target of targets) {
    try {
      await refreshNumberHealth(supabase, {
        accountId: target.account_id,
        phoneNumberId: target.phone_number_id,
        encryptedToken: target.access_token,
        source: 'webhook',
        metaEvent,
        detail: { field: change.field, value },
      })
    } catch (err) {
      // Meta unreachable or the token was rejected: keep the event itself
      // so the history still shows that Meta told us something happened.
      console.error(`[number-health-webhook] ${where} — refresh failed:`, err)
      const { error: insertError } = await supabase
        .from('number_health_events')
        .insert({
          account_id: target.account_id,
          phone_number_id: target.phone_number_id,
          kind: 'meta_event',
          previous_value: null,
          new_value: value.current_limit ?? null,
          meta_event: metaEvent ?? null,
          source: 'webhook',
          detail: { field: change.field, value },
        })
      if (insertError) {
        console.error('[number-health-webhook] event insert failed:', insertError.message)
      }
    }
  }
}
