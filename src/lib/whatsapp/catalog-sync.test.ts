import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The real decrypt needs ENCRYPTION_KEY at import time. The sync only
// needs "an access token comes out", so fake it.
vi.mock('./encryption', () => ({ decrypt: (s: string) => `plain-${s}` }))

import {
  CATALOG_MAX_PAGES,
  CatalogNotConnectedError,
  CatalogTooLargeError,
  syncCatalog,
} from './catalog-sync'

/** A just-enough Supabase fake that records what the sync writes. */
function fakeSupabase(opts: { deleteCount?: number; upsertError?: string } = {}) {
  const upserts: { rows: Record<string, unknown>[]; options: unknown }[] = []
  const deletes: { filters: [string, string, unknown][] }[] = []
  const configUpdates: { values: Record<string, unknown>; accountId: unknown }[] = []

  const client = {
    from(table: string) {
      if (table === 'catalog_items') {
        return {
          upsert(rows: Record<string, unknown>[], options: unknown) {
            upserts.push({ rows, options })
            return Promise.resolve({
              error: opts.upsertError ? { message: opts.upsertError } : null,
            })
          },
          delete() {
            const call = { filters: [] as [string, string, unknown][] }
            deletes.push(call)
            const chain = {
              eq(col: string, val: unknown) {
                call.filters.push(['eq', col, val])
                return chain
              },
              lt(col: string, val: unknown) {
                call.filters.push(['lt', col, val])
                return Promise.resolve({ error: null, count: opts.deleteCount ?? 0 })
              },
            }
            return chain
          },
        }
      }
      if (table === 'whatsapp_config') {
        return {
          update(values: Record<string, unknown>) {
            return {
              eq(_col: string, accountId: unknown) {
                configUpdates.push({ values, accountId })
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { client: client as unknown as SupabaseClient, upserts, deletes, configUpdates }
}

let urls: string[] = []
let pages: unknown[]
let catalogs: unknown

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

beforeEach(() => {
  urls = []
  catalogs = { data: [{ id: 'cat-1', name: 'Products for MJA' }] }
  pages = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/product_catalogs')) return json(catalogs)
      const next = pages.shift()
      return json(next ?? { data: [] })
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const ARGS = { accountId: 'acc-1', wabaId: 'waba-1', encryptedToken: 'enc' } as const

describe('syncCatalog', () => {
  it('copies every page into catalog_items and records the sync', async () => {
    pages = [
      {
        data: [
          { retailer_id: 'a', name: 'Magic Mug', price: '₹300.00', sale_price: '₹225.00' },
          { retailer_id: 'b', name: 'White Mug', price: '₹200.00' },
        ],
        paging: { cursors: { after: 'P2' }, next: 'https://graph.facebook.com/v26.0/x' },
      },
      { data: [{ retailer_id: 'c', name: 'Frame', price: '₹1,210.00' }] },
    ]
    const db = fakeSupabase({ deleteCount: 4 })

    const out = await syncCatalog(db.client, ARGS)

    expect(out).toEqual({
      catalogId: 'cat-1',
      catalogName: 'Products for MJA',
      itemCount: 3,
      removed: 4,
    })
    expect(db.upserts).toHaveLength(1)
    expect(db.upserts[0].options).toEqual({ onConflict: 'account_id,retailer_id' })
    expect(db.upserts[0].rows.map((r) => r.retailer_id)).toEqual(['a', 'b', 'c'])
    expect(db.upserts[0].rows[0]).toMatchObject({
      account_id: 'acc-1',
      catalog_id: 'cat-1',
      price_amount: 300,
      sale_price_amount: 225,
    })
    // The second page was asked for with the first page's cursor.
    expect(new URL(urls[2]).searchParams.get('after')).toBe('P2')
    expect(db.configUpdates).toHaveLength(1)
    expect(db.configUpdates[0].accountId).toBe('acc-1')
    expect(db.configUpdates[0].values).toMatchObject({
      catalog_id: 'cat-1',
      catalog_name: 'Products for MJA',
    })
  })

  it('removes only rows from before this run, for this account', async () => {
    pages = [{ data: [{ retailer_id: 'a', name: 'Mug' }] }]
    const db = fakeSupabase()
    await syncCatalog(db.client, ARGS)
    const filters = db.deletes[0].filters
    expect(filters).toContainEqual(['eq', 'account_id', 'acc-1'])
    const lt = filters.find((f) => f[0] === 'lt')
    expect(lt?.[1]).toBe('synced_at')
    // Every upserted row carries the run's timestamp, which the delete compares against.
    expect(lt?.[2]).toBe(db.upserts[0].rows[0].synced_at)
  })

  it('does not wipe the stored copy when Meta returns no items', async () => {
    pages = [{ data: [] }]
    const db = fakeSupabase()
    const out = await syncCatalog(db.client, ARGS)
    expect(out.itemCount).toBe(0)
    expect(db.upserts).toHaveLength(0)
    expect(db.deletes).toHaveLength(0)
  })

  it('keeps one row when Meta lists the same retailer ID twice', async () => {
    pages = [
      {
        data: [
          { retailer_id: 'a', name: 'Old name' },
          { retailer_id: 'a', name: 'New name' },
        ],
      },
    ]
    const db = fakeSupabase()
    const out = await syncCatalog(db.client, ARGS)
    expect(out.itemCount).toBe(1)
    expect(db.upserts[0].rows[0].name).toBe('New name')
  })

  it('skips items that have no retailer ID or name', async () => {
    pages = [{ data: [{ name: 'No id' }, { retailer_id: 'x' }, { retailer_id: 'ok', name: 'Fine' }] }]
    const db = fakeSupabase()
    const out = await syncCatalog(db.client, ARGS)
    expect(out.itemCount).toBe(1)
  })

  it('prefers the catalogue copied last time', async () => {
    catalogs = {
      data: [
        { id: 'cat-1', name: 'First' },
        { id: 'cat-2', name: 'Second' },
      ],
    }
    pages = [{ data: [{ retailer_id: 'a', name: 'Mug' }] }]
    const db = fakeSupabase()
    const out = await syncCatalog(db.client, { ...ARGS, preferredCatalogId: 'cat-2' })
    expect(out.catalogId).toBe('cat-2')
  })

  it('throws when no catalogue is connected', async () => {
    catalogs = { data: [] }
    const db = fakeSupabase()
    await expect(syncCatalog(db.client, ARGS)).rejects.toBeInstanceOf(CatalogNotConnectedError)
    expect(db.upserts).toHaveLength(0)
  })

  it('refuses a catalogue that never ends, without writing anything', async () => {
    // Every page says there is another one.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/product_catalogs')
          ? json(catalogs)
          : json({
              data: [{ retailer_id: crypto.randomUUID(), name: 'X' }],
              paging: { cursors: { after: 'MORE' }, next: 'https://graph.facebook.com/v26.0/x' },
            }),
      ),
    )
    const db = fakeSupabase()
    await expect(syncCatalog(db.client, ARGS)).rejects.toBeInstanceOf(CatalogTooLargeError)
    expect(CATALOG_MAX_PAGES).toBe(50)
    expect(db.upserts).toHaveLength(0)
  })

  it('throws, and skips the cleanup, when the write fails', async () => {
    pages = [{ data: [{ retailer_id: 'a', name: 'Mug' }] }]
    const db = fakeSupabase({ upsertError: 'boom' })
    await expect(syncCatalog(db.client, ARGS)).rejects.toThrow('catalog_items upsert: boom')
    expect(db.deletes).toHaveLength(0)
    expect(db.configUpdates).toHaveLength(0)
  })
})
