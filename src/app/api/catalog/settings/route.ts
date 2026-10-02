import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { decrypt } from '@/lib/whatsapp/encryption'
import { explainCatalogError } from '@/lib/whatsapp/catalog'
import { getCommerceSettings, MetaApiError } from '@/lib/whatsapp/meta-api'
import { numberHealthAdmin } from '@/lib/whatsapp/number-health-sync'

/**
 * GET /api/catalog/settings  (admin+)
 *
 * Reads, live from Meta, whether the shop icon and the basket button are
 * on for the account's number. Read only. `null` means Meta did not
 * confirm a value (it returns nothing until a setting has been saved
 * through its API).
 */
export async function GET() {
  try {
    const { accountId } = await requireRole('admin')

    const { data: config } = await numberHealthAdmin()
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config || config.status !== 'connected') {
      return NextResponse.json({ status: 'not_connected' })
    }

    try {
      const settings = await getCommerceSettings({
        phoneNumberId: config.phone_number_id as string,
        accessToken: decrypt(config.access_token as string),
      })
      return NextResponse.json({
        status: 'ok',
        cartEnabled: settings.cartEnabled,
        catalogVisible: settings.catalogVisible,
      })
    } catch (err) {
      if (err instanceof MetaApiError) {
        const explained = explainCatalogError(err)
        console.error('[catalog settings] Meta call failed:', {
          message: err.message,
          code: err.code,
          fbtraceId: err.fbtraceId,
        })
        return NextResponse.json({ status: 'unavailable', error: explained.summary })
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
