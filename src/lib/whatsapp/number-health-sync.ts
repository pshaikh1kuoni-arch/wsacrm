/**
 * Read a number's health from Meta, store the current values and record
 * what changed. Shared by the webhook handler and the page's API routes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from './encryption'
import { getPhoneNumberHealth } from './meta-api'
import {
  diffHealth,
  normalizeQuality,
  type HealthSnapshot,
} from './number-health'

// Lazy so a missing env var does not crash the build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: any = null
/** Service-role client for writes the caller's RLS session cannot make. */
export function numberHealthAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _admin as SupabaseClient
}

export interface RefreshArgs {
  accountId: string
  phoneNumberId: string
  /** `whatsapp_config.access_token`, still encrypted. */
  encryptedToken: string
  source: 'webhook' | 'sync'
  /** Meta's own event name (UPGRADE, DOWNGRADE, FLAGGED, …) when known. */
  metaEvent?: string
  detail?: Record<string, unknown>
}

export interface StoredHealth extends HealthSnapshot {
  account_id: string
  phone_number_id: string
  display_phone_number: string | null
  verified_name: string | null
  name_status: string | null
  synced_at: string
}

/**
 * Fetch the number's current health from Meta and store it. Records a
 * history row per change; when Meta announced an event but nothing we
 * track changed (e.g. FLAGGED), records the event itself. Throws when
 * the Meta call fails, so callers decide what to keep.
 */
export async function refreshNumberHealth(
  supabase: SupabaseClient,
  args: RefreshArgs,
): Promise<StoredHealth> {
  const info = await getPhoneNumberHealth({
    phoneNumberId: args.phoneNumberId,
    accessToken: decrypt(args.encryptedToken),
  })

  const next: StoredHealth = {
    account_id: args.accountId,
    phone_number_id: args.phoneNumberId,
    display_phone_number: info.display_phone_number ?? null,
    verified_name: info.verified_name ?? null,
    quality_rating: normalizeQuality(info.quality_rating),
    messaging_limit_tier: info.messaging_limit_tier ?? null,
    name_status: info.name_status ?? null,
    synced_at: new Date().toISOString(),
  }

  const { data: prevRow } = await supabase
    .from('number_health')
    .select('quality_rating, messaging_limit_tier')
    .eq('account_id', args.accountId)
    .maybeSingle()

  const { error: upsertError } = await supabase
    .from('number_health')
    .upsert(next, { onConflict: 'account_id' })
  if (upsertError) throw new Error(`number_health upsert: ${upsertError.message}`)

  const changes = diffHealth((prevRow as HealthSnapshot | null) ?? null, next)
  const base = {
    account_id: args.accountId,
    phone_number_id: args.phoneNumberId,
    source: args.source,
    meta_event: args.metaEvent ?? null,
    detail: args.detail ?? null,
  }
  const rows: Record<string, unknown>[] =
    changes.length > 0
      ? changes.map((c) => ({
          ...base,
          kind: c.kind,
          previous_value: c.previous,
          new_value: c.next,
        }))
      : args.metaEvent
        ? [{ ...base, kind: 'meta_event', previous_value: null, new_value: null }]
        : []

  if (rows.length > 0) {
    const { error } = await supabase.from('number_health_events').insert(rows)
    if (error) console.error('[number-health] event insert failed:', error.message)
  }

  return next
}
