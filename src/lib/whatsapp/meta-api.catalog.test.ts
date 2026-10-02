import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCatalogProducts,
  getCommerceSettings,
  getWabaCatalogs,
  MetaApiError,
} from './meta-api'

/**
 * Catalogue reads. All three are plain GETs with the token in the
 * Authorization header, never in the URL.
 *
 * Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/
 */

let capturedUrl: string | null = null
let capturedInit: RequestInit | null = null
let respond: () => Response

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  capturedUrl = null
  capturedInit = null
  respond = () => json({})
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return respond()
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getWabaCatalogs', () => {
  it('asks the WhatsApp account for its catalogues', async () => {
    respond = () => json({ data: [{ id: '371059440191188', name: 'Products for MJA' }] })
    const out = await getWabaCatalogs({ wabaId: 'waba-1', accessToken: 'tok' })
    expect(capturedUrl).toBe('https://graph.facebook.com/v21.0/waba-1/product_catalogs')
    expect(capturedInit?.headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(out).toEqual([{ id: '371059440191188', name: 'Products for MJA' }])
  })

  it('returns an empty list when nothing is connected', async () => {
    respond = () => json({ data: [] })
    expect(await getWabaCatalogs({ wabaId: 'w', accessToken: 't' })).toEqual([])
  })

  it('throws Meta\'s error with its envelope', async () => {
    respond = () =>
      json(
        {
          error: {
            message: '(#100) This application has not been approved to use this api.',
            code: 100,
            fbtrace_id: 'trace-1',
          },
        },
        400,
      )
    const err = await getWabaCatalogs({ wabaId: 'w', accessToken: 't' }).catch((e) => e)
    expect(err).toBeInstanceOf(MetaApiError)
    expect(err.code).toBe(100)
    expect(err.fbtraceId).toBe('trace-1')
  })
})

describe('getCatalogProducts', () => {
  it('asks for the stored fields, 100 at a time', async () => {
    await getCatalogProducts({ catalogId: 'cat-1', accessToken: 'tok' })
    const url = new URL(String(capturedUrl))
    expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v21.0/cat-1/products')
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.get('fields')).toBe(
      'retailer_id,retailer_product_group_id,name,price,sale_price,currency,availability,image_url,url',
    )
    expect(url.searchParams.has('after')).toBe(false)
    expect(capturedInit?.headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(String(capturedUrl)).not.toContain('tok')
  })

  it('passes the cursor back on our own API version', async () => {
    await getCatalogProducts({ catalogId: 'cat-1', accessToken: 't', after: 'CURSOR', limit: 25 })
    const url = new URL(String(capturedUrl))
    expect(url.searchParams.get('after')).toBe('CURSOR')
    expect(url.searchParams.get('limit')).toBe('25')
  })

  it('returns a cursor only when Meta says there is a next page', async () => {
    respond = () =>
      json({
        data: [{ retailer_id: 'a', name: 'A' }],
        paging: { cursors: { after: 'NEXT' }, next: 'https://graph.facebook.com/v26.0/x' },
      })
    const more = await getCatalogProducts({ catalogId: 'c', accessToken: 't' })
    expect(more.nextCursor).toBe('NEXT')
    expect(more.products).toHaveLength(1)

    // The last page still carries cursors but has no `next`.
    respond = () => json({ data: [], paging: { cursors: { after: 'END' } } })
    const last = await getCatalogProducts({ catalogId: 'c', accessToken: 't' })
    expect(last.nextCursor).toBeNull()
  })
})

describe('getCommerceSettings', () => {
  it('reads the cart and catalogue switches for the number', async () => {
    respond = () => json({ data: [{ is_cart_enabled: true, is_catalog_visible: false }] })
    const out = await getCommerceSettings({ phoneNumberId: 'ph-1', accessToken: 'tok' })
    const url = new URL(String(capturedUrl))
    expect(url.origin + url.pathname).toBe(
      'https://graph.facebook.com/v21.0/ph-1/whatsapp_commerce_settings',
    )
    expect(url.searchParams.get('fields')).toBe('id,is_cart_enabled,is_catalog_visible')
    expect(out).toEqual({ cartEnabled: true, catalogVisible: false })
  })

  it('reports null for both when Meta returns nothing', async () => {
    respond = () => json({ data: [] })
    expect(await getCommerceSettings({ phoneNumberId: 'p', accessToken: 't' })).toEqual({
      cartEnabled: null,
      catalogVisible: null,
    })
  })
})
