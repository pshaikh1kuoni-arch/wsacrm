import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { explainCatalogError } from '@/lib/whatsapp/catalog'
import {
  CatalogNotConnectedError,
  CatalogTooLargeError,
  syncCatalog,
} from '@/lib/whatsapp/catalog-sync'
import { MetaApiError } from '@/lib/whatsapp/meta-api'
import { numberHealthAdmin } from '@/lib/whatsapp/number-health-sync'

// Ignore a second sync this soon after the last one.
const MIN_INTERVAL_MS = 20_000

/**
 * POST /api/catalog/sync  (admin+)
 *
 * Copies the account's Meta catalogue into `catalog_items`. Read only
 * towards Meta.
 */
export async function POST() {
  try {
    const { accountId } = await requireRole('admin')
    const admin = numberHealthAdmin()

    const { data: config } = await admin
      .from('whatsapp_config')
      .select('waba_id, access_token, status, catalog_id, catalog_synced_at')
      .eq('account_id', accountId)
      .maybeSingle()
    if (!config || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'Connect a WhatsApp number first.' },
        { status: 400 },
      )
    }
    if (!config.waba_id) {
      return NextResponse.json(
        {
          error:
            'Add your WhatsApp Business Account ID in the connection first, so the catalogue can be found.',
        },
        { status: 400 },
      )
    }
    if (
      config.catalog_synced_at &&
      Date.now() - Date.parse(config.catalog_synced_at as string) < MIN_INTERVAL_MS
    ) {
      return NextResponse.json({ synced: false })
    }

    try {
      const result = await syncCatalog(admin, {
        accountId,
        wabaId: config.waba_id as string,
        encryptedToken: config.access_token as string,
        preferredCatalogId: (config.catalog_id as string | null) ?? null,
      })
      return NextResponse.json({ synced: true, ...result })
    } catch (err) {
      if (err instanceof CatalogNotConnectedError) {
        return NextResponse.json(
          {
            error:
              'No catalogue is connected to this WhatsApp Business Account yet. Connect one in WhatsApp Manager, then try again.',
            code: 'no_catalog',
          },
          { status: 400 },
        )
      }
      if (err instanceof CatalogTooLargeError) {
        return NextResponse.json(
          {
            error: `The catalogue has more than ${err.limit.toLocaleString('en-US')} items, which is more than the CRM can copy.`,
            code: 'too_large',
          },
          { status: 400 },
        )
      }
      if (err instanceof MetaApiError) {
        const explained = explainCatalogError(err)
        console.error('[catalog sync] Meta call failed:', {
          message: err.message,
          code: err.code,
          subcode: err.subcode,
          fbtraceId: err.fbtraceId,
        })
        return NextResponse.json(
          {
            error: explained.summary,
            meta: {
              code: explained.code,
              subcode: explained.subcode,
              fbtrace_id: explained.fbtraceId,
              message: explained.metaMessage,
            },
          },
          { status: explained.httpStatus },
        )
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
