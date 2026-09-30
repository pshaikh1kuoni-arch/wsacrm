import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import {
  numberHealthAdmin,
  refreshNumberHealth,
} from '@/lib/whatsapp/number-health-sync'
import {
  explainMetaError,
  metaErrorPayload,
} from '@/lib/whatsapp/meta-error-explain'
import { MetaApiError } from '@/lib/whatsapp/meta-api'

// Ignore a second refresh this soon after the last one.
const MIN_INTERVAL_MS = 30_000

/**
 * POST /api/number-health/refresh  (admin+)
 *
 * Re-reads the number's quality rating and messaging limit from Meta.
 */
export async function POST() {
  try {
    const { accountId } = await requireRole('admin')
    const admin = numberHealthAdmin()

    const { data: config } = await admin
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'Connect a WhatsApp number first.' },
        { status: 400 },
      )
    }

    const { data: current } = await admin
      .from('number_health')
      .select('synced_at')
      .eq('account_id', accountId)
      .maybeSingle()
    if (
      current?.synced_at &&
      Date.now() - Date.parse(current.synced_at) < MIN_INTERVAL_MS
    ) {
      return NextResponse.json({ refreshed: false })
    }

    try {
      await refreshNumberHealth(admin, {
        accountId,
        phoneNumberId: config.phone_number_id as string,
        encryptedToken: config.access_token as string,
        source: 'sync',
      })
    } catch (err) {
      if (err instanceof MetaApiError) {
        const explained = explainMetaError(err, 'verify_number', {
          phoneNumberId: config.phone_number_id as string,
        })
        return NextResponse.json(
          { error: explained.summary, meta: metaErrorPayload(explained) },
          { status: explained.httpStatus },
        )
      }
      throw err
    }
    return NextResponse.json({ refreshed: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
