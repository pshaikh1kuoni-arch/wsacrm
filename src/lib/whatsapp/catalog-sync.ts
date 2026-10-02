/**
 * Copy the account's Meta catalogue into `catalog_items`.
 *
 * Read only towards Meta. The whole catalogue is fetched before anything
 * is written, so a Meta failure half way leaves the old copy untouched.
 *
 * Plan: docs/catalog-cart-plan.md
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { toCatalogRow, type CatalogItemRow } from './catalog'
import { decrypt } from './encryption'
import { getCatalogProducts, getWabaCatalogs } from './meta-api'

export const CATALOG_PAGE_SIZE = 100
/** 50 pages of 100: a catalogue larger than this is refused, not half copied. */
export const CATALOG_MAX_PAGES = 50
const UPSERT_CHUNK = 500

export class CatalogNotConnectedError extends Error {
  constructor() {
    super('No catalogue is connected to this WhatsApp Business Account.')
    this.name = 'CatalogNotConnectedError'
  }
}

export class CatalogTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`The catalogue has more than ${limit} items.`)
    this.name = 'CatalogTooLargeError'
  }
}

export interface SyncCatalogArgs {
  accountId: string
  wabaId: string
  /** `whatsapp_config.access_token`, still encrypted. */
  encryptedToken: string
  /** The catalogue copied last time, preferred when Meta lists it. */
  preferredCatalogId?: string | null
}

export interface SyncCatalogResult {
  catalogId: string
  catalogName: string | null
  /** Items now stored. */
  itemCount: number
  /** Items that were stored before and are gone from the catalogue. */
  removed: number
}

export async function syncCatalog(
  supabase: SupabaseClient,
  args: SyncCatalogArgs,
): Promise<SyncCatalogResult> {
  const accessToken = decrypt(args.encryptedToken)

  const catalogs = await getWabaCatalogs({ wabaId: args.wabaId, accessToken })
  const chosen = catalogs.find((c) => c.id === args.preferredCatalogId) ?? catalogs[0]
  if (!chosen) throw new CatalogNotConnectedError()

  // Every row of this run carries the same timestamp, so "older than the
  // start of this run" later means "no longer in the catalogue".
  const startedAt = new Date().toISOString()
  const byRetailerId = new Map<string, CatalogItemRow>()
  let cursor: string | null = null
  for (let page = 0; ; page++) {
    if (page >= CATALOG_MAX_PAGES) {
      throw new CatalogTooLargeError(CATALOG_MAX_PAGES * CATALOG_PAGE_SIZE)
    }
    const res = await getCatalogProducts({
      catalogId: chosen.id,
      accessToken,
      after: cursor,
      limit: CATALOG_PAGE_SIZE,
    })
    for (const product of res.products) {
      const row = toCatalogRow(args.accountId, chosen.id, product, startedAt)
      if (row) byRetailerId.set(row.retailer_id, row)
    }
    if (!res.nextCursor) break
    cursor = res.nextCursor
  }

  const rows = [...byRetailerId.values()]
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabase
      .from('catalog_items')
      .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'account_id,retailer_id' })
    if (error) throw new Error(`catalog_items upsert: ${error.message}`)
  }

  // An empty answer from Meta never wipes the stored copy: it is far more
  // likely to be a hiccup than a catalogue that was truly emptied.
  let removed = 0
  if (rows.length > 0) {
    const { error, count } = await supabase
      .from('catalog_items')
      .delete({ count: 'exact' })
      .eq('account_id', args.accountId)
      .lt('synced_at', startedAt)
    if (error) throw new Error(`catalog_items cleanup: ${error.message}`)
    removed = count ?? 0
  }

  const { error: configError } = await supabase
    .from('whatsapp_config')
    .update({
      catalog_id: chosen.id,
      catalog_name: chosen.name,
      catalog_synced_at: new Date().toISOString(),
    })
    .eq('account_id', args.accountId)
  if (configError) throw new Error(`whatsapp_config update: ${configError.message}`)

  return {
    catalogId: chosen.id,
    catalogName: chosen.name,
    itemCount: rows.length,
    removed,
  }
}
