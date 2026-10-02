import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { numberHealthAdmin } from '@/lib/whatsapp/number-health-sync'

/**
 * GET /api/catalog  (any member)
 *
 * Where the catalogue copy stands: which catalogue was copied, how many
 * items are stored and when it was last synced. Reads our own database
 * only, never Meta, so it is cheap to call whenever the card opens.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer')

    // whatsapp_config holds the access token, which a viewer's session may
    // not read, so this one lookup uses the service role — for the caller's
    // own account id only. Only non-secret columns are selected.
    const { data: config } = await numberHealthAdmin()
      .from('whatsapp_config')
      .select('status, waba_id, catalog_id, catalog_name, catalog_synced_at')
      .eq('account_id', accountId)
      .maybeSingle()

    if (!config || config.status !== 'connected') {
      return NextResponse.json({ status: 'not_connected' })
    }
    if (!config.waba_id) {
      return NextResponse.json({ status: 'no_waba' })
    }

    const { count } = await supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      status: config.catalog_synced_at ? 'ok' : 'not_synced',
      catalogId: (config.catalog_id as string | null) ?? null,
      catalogName: (config.catalog_name as string | null) ?? null,
      itemCount: count ?? 0,
      syncedAt: (config.catalog_synced_at as string | null) ?? null,
    })
  } catch (err) {
    return toErrorResponse(err)
  }
}
