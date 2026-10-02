import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sendInteractiveCatalog,
  sendInteractiveProduct,
  sendInteractiveProductList,
  MetaApiError,
} from './meta-api'

/**
 * Product messages. Payload shapes follow Meta's pages for single product,
 * multi product and catalogue messages:
 * developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/
 */

let capturedUrl: string | null = null
let capturedBody: Record<string, unknown> | null = null
let capturedInit: RequestInit | null = null
let respond: () => Response

beforeEach(() => {
  capturedUrl = null
  capturedBody = null
  capturedInit = null
  respond = () => new Response(JSON.stringify({ messages: [{ id: 'wamid.p1' }] }), { status: 200 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      capturedBody = JSON.parse(String(init.body))
      return respond()
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const BASE = { phoneNumberId: 'ph-1', accessToken: 'tok', to: '919876543210' } as const

describe('sendInteractiveProduct', () => {
  it('sends a single product card', async () => {
    const out = await sendInteractiveProduct({
      ...BASE,
      bodyText: 'This one is popular.',
      footerText: 'Free delivery',
      catalogId: 'cat-1',
      productRetailerId: '13738612713_2713',
    })
    expect(out.messageId).toBe('wamid.p1')
    expect(capturedUrl).toBe('https://graph.facebook.com/v21.0/ph-1/messages')
    expect(capturedInit?.headers).toMatchObject({ Authorization: 'Bearer tok' })
    expect(capturedBody).toMatchObject({
      messaging_product: 'whatsapp',
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: 'This one is popular.' },
        footer: { text: 'Free delivery' },
        action: { catalog_id: 'cat-1', product_retailer_id: '13738612713_2713' },
      },
    })
  })

  it('leaves the footer out when there is none', async () => {
    await sendInteractiveProduct({
      ...BASE,
      bodyText: 'Hi',
      catalogId: 'c',
      productRetailerId: 'p',
    })
    const interactive = (capturedBody as { interactive: Record<string, unknown> }).interactive
    expect('footer' in interactive).toBe(false)
  })

  it('threads a reply context', async () => {
    await sendInteractiveProduct({
      ...BASE,
      bodyText: 'Hi',
      catalogId: 'c',
      productRetailerId: 'p',
      contextMessageId: 'wamid.parent',
    })
    expect(capturedBody).toMatchObject({ context: { message_id: 'wamid.parent' } })
  })

  it('refuses an empty body, catalogue or product before calling Meta', async () => {
    await expect(
      sendInteractiveProduct({ ...BASE, bodyText: '', catalogId: 'c', productRetailerId: 'p' }),
    ).rejects.toThrow(/bodyText/)
    await expect(
      sendInteractiveProduct({ ...BASE, bodyText: 'x', catalogId: '', productRetailerId: 'p' }),
    ).rejects.toThrow(/catalogue/)
    await expect(
      sendInteractiveProduct({ ...BASE, bodyText: 'x', catalogId: 'c', productRetailerId: '' }),
    ).rejects.toThrow(/product/)
    expect(capturedUrl).toBeNull()
  })

  it('throws Meta\'s error with its envelope', async () => {
    respond = () =>
      new Response(JSON.stringify({ error: { message: 'bad product', code: 131009 } }), {
        status: 400,
      })
    const err = await sendInteractiveProduct({
      ...BASE,
      bodyText: 'x',
      catalogId: 'c',
      productRetailerId: 'p',
    }).catch((e) => e)
    expect(err).toBeInstanceOf(MetaApiError)
    expect(err.code).toBe(131009)
  })
})

describe('sendInteractiveProductList', () => {
  const list = {
    ...BASE,
    headerText: 'Our mugs',
    bodyText: 'Here are a few options.',
    catalogId: 'cat-1',
    sections: [{ title: 'Our mugs', productRetailerIds: ['a', 'b', 'c'] }],
  }

  it('sends the sections as product_items', async () => {
    await sendInteractiveProductList({ ...list, footerText: 'Tap to browse' })
    expect(capturedBody).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: 'Our mugs' },
        body: { text: 'Here are a few options.' },
        footer: { text: 'Tap to browse' },
        action: {
          catalog_id: 'cat-1',
          sections: [
            {
              title: 'Our mugs',
              product_items: [
                { product_retailer_id: 'a' },
                { product_retailer_id: 'b' },
                { product_retailer_id: 'c' },
              ],
            },
          ],
        },
      },
    })
  })

  it('allows a single section with no title', async () => {
    await sendInteractiveProductList({
      ...list,
      sections: [{ productRetailerIds: ['a', 'b'] }],
    })
    const sections = (
      capturedBody as { interactive: { action: { sections: Record<string, unknown>[] } } }
    ).interactive.action.sections
    expect('title' in sections[0]).toBe(false)
  })

  it('needs a title on every section when there are several', async () => {
    await expect(
      sendInteractiveProductList({
        ...list,
        sections: [
          { title: 'One', productRetailerIds: ['a'] },
          { productRetailerIds: ['b'] },
        ],
      }),
    ).rejects.toThrow(/title/)
  })

  it('accepts exactly 30 products and refuses 31', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
    await sendInteractiveProductList({
      ...list,
      sections: [{ title: 'All', productRetailerIds: ids(30) }],
    })
    expect(capturedBody).not.toBeNull()
    capturedBody = null
    await expect(
      sendInteractiveProductList({
        ...list,
        sections: [{ title: 'All', productRetailerIds: ids(31) }],
      }),
    ).rejects.toThrow(/at most 30/)
    expect(capturedBody).toBeNull()
  })

  it('refuses the same product twice', async () => {
    await expect(
      sendInteractiveProductList({
        ...list,
        sections: [{ title: 'Dup', productRetailerIds: ['a', 'a'] }],
      }),
    ).rejects.toThrow(/twice/)
  })

  it('refuses more than 10 sections, a long header and a missing header', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      title: `S${i}`,
      productRetailerIds: [`p${i}`],
    }))
    await expect(sendInteractiveProductList({ ...list, sections: eleven })).rejects.toThrow(
      /1-10 sections/,
    )
    await expect(
      sendInteractiveProductList({ ...list, headerText: 'x'.repeat(61) }),
    ).rejects.toThrow(/60 chars/)
    await expect(sendInteractiveProductList({ ...list, headerText: '' })).rejects.toThrow(
      /header/,
    )
  })

  it('refuses a section with no products', async () => {
    await expect(
      sendInteractiveProductList({ ...list, sections: [{ title: 'Empty', productRetailerIds: [] }] }),
    ).rejects.toThrow(/at least one product/)
  })
})

describe('sendInteractiveCatalog', () => {
  it('sends a catalogue message with a thumbnail item', async () => {
    await sendInteractiveCatalog({
      ...BASE,
      bodyText: 'Browse our catalogue.',
      footerText: 'Prices in INR',
      thumbnailRetailerId: '13738612713_2713',
    })
    expect(capturedBody).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: 'Browse our catalogue.' },
        footer: { text: 'Prices in INR' },
        action: {
          name: 'catalog_message',
          parameters: { thumbnail_product_retailer_id: '13738612713_2713' },
        },
      },
    })
  })

  it('leaves the thumbnail out when none is chosen, so Meta uses the first item', async () => {
    await sendInteractiveCatalog({ ...BASE, bodyText: 'Browse.' })
    const action = (capturedBody as { interactive: { action: Record<string, unknown> } })
      .interactive.action
    expect(action).toEqual({ name: 'catalog_message' })
  })

  it('refuses an empty or over-long body and an over-long footer', async () => {
    await expect(sendInteractiveCatalog({ ...BASE, bodyText: '' })).rejects.toThrow(/bodyText/)
    await expect(
      sendInteractiveCatalog({ ...BASE, bodyText: 'x'.repeat(1025) }),
    ).rejects.toThrow(/1024/)
    await expect(
      sendInteractiveCatalog({ ...BASE, bodyText: 'ok', footerText: 'y'.repeat(61) }),
    ).rejects.toThrow(/60/)
  })
})
