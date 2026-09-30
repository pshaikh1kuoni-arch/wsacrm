import { NextResponse } from 'next/server'
import {
  ForbiddenError,
  requireRole,
  toErrorResponse,
} from '@/lib/auth/account'
import {
  isPartnerOperator,
  summarizePlatform,
  type PlatformRow,
} from '@/lib/whatsapp/number-health'
import { numberHealthAdmin } from '@/lib/whatsapp/number-health-sync'

/**
 * GET /api/number-health/partner  (owner + PARTNER_OPERATOR_EMAILS)
 *
 * Tech Partner progress across every account on this deployment: average
 * daily messages over 7 days and the accounts that were active in the
 * last 30 days. Other accounts' names are visible here, so it is limited
 * to the operator emails listed in the environment — an ordinary account
 * owner gets 403 even though they own their own account.
 */
export async function GET() {
  try {
    const { supabase } = await requireRole('owner')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!isPartnerOperator(user?.email, process.env.PARTNER_OPERATOR_EMAILS)) {
      throw new ForbiddenError('Not a partner operator')
    }

    const { data, error } = await numberHealthAdmin().rpc(
      'number_health_platform_summary',
    )
    if (error) {
      console.error('[number-health partner] summary failed:', error)
      return NextResponse.json(
        { error: 'Failed to load partner summary' },
        { status: 500 },
      )
    }

    const rows = ((data ?? []) as PlatformRow[]).map((r) => ({
      ...r,
      messages_30d: Number(r.messages_30d),
      messages_7d: Number(r.messages_7d),
    }))
    return NextResponse.json(summarizePlatform(rows))
  } catch (err) {
    return toErrorResponse(err)
  }
}
