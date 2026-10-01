import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { getWabaUsage, MetaApiError } from '@/lib/whatsapp/meta-api'
import { numberHealthAdmin } from '@/lib/whatsapp/number-health-sync'
import { summarizeUsage, usageWindow } from '@/lib/whatsapp/usage'

/**
 * GET /api/number-health/usage  (any member)
 *
 * What the account's WhatsApp messages cost over the last 30 days, read
 * live from Meta. Kept apart from /api/number-health so a Meta failure
 * here never breaks the rest of the page.
 */
export async function GET() {
  try {
    const { accountId } = await requireRole('viewer')

    // The token lives in whatsapp_config, which a viewer's session may not
    // read, so this one lookup uses the service role — for the caller's own
    // account id only.
    const { data: config } = await numberHealthAdmin()
      .from('whatsapp_config')
      .select('waba_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config || config.status !== 'connected') {
      return NextResponse.json({ status: 'not_connected' })
    }
    if (!config.waba_id) {
      return NextResponse.json({ status: 'no_waba' })
    }

    try {
      const { start, end } = usageWindow()
      const raw = await getWabaUsage({
        wabaId: config.waba_id as string,
        accessToken: decrypt(config.access_token as string),
        start,
        end,
      })
      return NextResponse.json({
        status: 'ok',
        usage: summarizeUsage(raw.dataPoints, raw.currency),
      })
    } catch (err) {
      console.error(
        '[number-health usage] Meta call failed:',
        err instanceof MetaApiError
          ? {
              message: err.message,
              code: err.code,
              subcode: err.subcode,
              fbtraceId: err.fbtraceId,
            }
          : err,
      )
      return NextResponse.json({ status: 'unavailable' })
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
