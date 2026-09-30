import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { isHealthStale, isPartnerOperator } from '@/lib/whatsapp/number-health'
import {
  numberHealthAdmin,
  refreshNumberHealth,
} from '@/lib/whatsapp/number-health-sync'

// A snapshot older than this is re-read from Meta when someone opens the
// page. The webhook keeps it fresh in between.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000
const EVENTS_LIMIT = 25
const DAILY_WINDOW_DAYS = 30

function validTimeZone(tz: string | null): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/**
 * GET /api/number-health?tz=Asia/Kolkata&light=1  (any member)
 *
 * The account's number health: current quality rating and messaging
 * limit, recent changes and messages per day. `light=1` returns only the
 * current health (used by the dashboard button). Reads the account's own
 * WhatsApp number only.
 */
export async function GET(request: Request) {
  try {
    const { supabase, accountId, role } = await requireRole('viewer')
    const url = new URL(request.url)
    const light = url.searchParams.get('light') === '1'
    const tz = validTimeZone(url.searchParams.get('tz'))

    // The token lives in whatsapp_config, which a viewer's session may not
    // read, so this one lookup uses the service role — for the caller's own
    // account id only.
    const admin = numberHealthAdmin()
    const { data: config } = await admin
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()
    const connected = !!config && config.status === 'connected'

    let { data: health } = await supabase
      .from('number_health')
      .select(
        'phone_number_id, display_phone_number, verified_name, quality_rating, messaging_limit_tier, name_status, synced_at',
      )
      .eq('account_id', accountId)
      .maybeSingle()

    let syncError: string | null = null
    if (config && connected && isHealthStale(health?.synced_at, STALE_AFTER_MS)) {
      try {
        const fresh = await refreshNumberHealth(admin, {
          accountId,
          phoneNumberId: config.phone_number_id as string,
          encryptedToken: config.access_token as string,
          source: 'sync',
        })
        health = fresh
      } catch (err) {
        console.error('[number-health GET] refresh failed:', err)
        syncError = 'Could not reach Meta. Showing the last saved values.'
      }
    }

    if (light) {
      return NextResponse.json({ connected, health: health ?? null })
    }

    const [eventsRes, dailyRes, userRes] = await Promise.all([
      supabase
        .from('number_health_events')
        .select('id, kind, previous_value, new_value, meta_event, source, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(EVENTS_LIMIT),
      supabase.rpc('number_health_daily_volume', {
        p_account_id: accountId,
        p_days: DAILY_WINDOW_DAYS,
        p_tz: tz,
      }),
      supabase.auth.getUser(),
    ])

    if (dailyRes.error) {
      console.error('[number-health GET] daily volume failed:', dailyRes.error)
    }

    return NextResponse.json({
      connected,
      health: health ?? null,
      events: eventsRes.data ?? [],
      daily: dailyRes.data ?? [],
      syncError,
      canViewPartner:
        role === 'owner' &&
        isPartnerOperator(
          userRes.data.user?.email,
          process.env.PARTNER_OPERATOR_EMAILS,
        ),
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
