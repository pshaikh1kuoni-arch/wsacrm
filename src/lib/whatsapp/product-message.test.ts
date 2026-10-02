import { describe, expect, it } from 'vitest'
import { validateInteractivePayload } from './interactive'
import {
  buildProductMessage,
  PRODUCT_LIST_MAX,
  toProductDisplay,
  type PickerItem,
} from './product-message'

function item(over: Partial<PickerItem> & { retailer_id: string }): PickerItem {
  return {
    name: 'Magic Mug',
    size: null,
    color: null,
    price_amount: 300,
    sale_price_amount: 225,
    currency: 'INR',
    availability: 'in_stock',
    image_url: 'https://example.com/m.jpg',
    ...over,
  }
}

describe('toProductDisplay', () => {
  it('shows the sale price and strikes through the normal one', () => {
    expect(toProductDisplay(item({ retailer_id: 'a' }))).toEqual({
      retailer_id: 'a',
      name: 'Magic Mug',
      price_text: '₹225',
      was_text: '₹300',
      image_url: 'https://example.com/m.jpg',
    })
  })

  it('shows only one price when there is no sale', () => {
    const d = toProductDisplay(item({ retailer_id: 'a', sale_price_amount: null }))
    expect(d.price_text).toBe('₹300')
    expect(d.was_text).toBeUndefined()
  })

  it('adds the variant label when there is one', () => {
    const d = toProductDisplay(item({ retailer_id: 'a', size: 'L', color: 'Black' }))
    expect(d.variant).toBe('L · Black')
  })

  it('leaves price and image out when the item has none', () => {
    const d = toProductDisplay(
      item({
        retailer_id: 'a',
        price_amount: null,
        sale_price_amount: null,
        image_url: null,
      }),
    )
    expect(d.price_text).toBeUndefined()
    expect(d.image_url).toBeUndefined()
  })
})

describe('buildProductMessage', () => {
  const base = { catalogId: 'cat-1', body: '  Here you go.  ', title: 'Our mugs' }

  it('builds a single product card for one item', () => {
    const p = buildProductMessage({
      ...base,
      mode: 'products',
      items: [item({ retailer_id: 'a' })],
    })
    expect(p).toMatchObject({
      kind: 'product',
      body: 'Here you go.',
      catalog_id: 'cat-1',
      retailer_id: 'a',
      display: { name: 'Magic Mug', price_text: '₹225' },
    })
    expect(validateInteractivePayload(p).ok).toBe(true)
  })

  it('builds one titled section for two or more items', () => {
    const p = buildProductMessage({
      ...base,
      mode: 'products',
      items: [item({ retailer_id: 'a' }), item({ retailer_id: 'b', name: 'White Mug' })],
    })
    expect(p).toMatchObject({
      kind: 'product_list',
      header: 'Our mugs',
      catalog_id: 'cat-1',
      sections: [{ title: 'Our mugs', retailer_ids: ['a', 'b'] }],
    })
    if (p.kind !== 'product_list') throw new Error('expected a product list')
    expect(p.display?.map((d) => d.name)).toEqual(['Magic Mug', 'White Mug'])
    expect(validateInteractivePayload(p).ok).toBe(true)
  })

  it('cuts a long title to the section title limit', () => {
    const p = buildProductMessage({
      ...base,
      title: 'A very long list title that goes past the limit',
      mode: 'products',
      items: [item({ retailer_id: 'a' }), item({ retailer_id: 'b' })],
    })
    if (p.kind !== 'product_list') throw new Error('expected a product list')
    expect(p.header.length).toBe(24)
    expect(p.sections[0].title).toBe(p.header)
    expect(validateInteractivePayload(p).ok).toBe(true)
  })

  it('builds a catalogue message for the whole catalogue and ignores the items', () => {
    const p = buildProductMessage({
      ...base,
      mode: 'catalog',
      items: [item({ retailer_id: 'a' })],
    })
    expect(p).toEqual({ kind: 'catalog', body: 'Here you go.' })
  })

  it('keeps a footer only when it has text', () => {
    const withFooter = buildProductMessage({
      ...base,
      footer: ' Free delivery ',
      mode: 'catalog',
      items: [],
    })
    expect(withFooter).toMatchObject({ footer: 'Free delivery' })
    const blank = buildProductMessage({ ...base, footer: '  ', mode: 'catalog', items: [] })
    expect('footer' in blank).toBe(false)
  })

  it('refuses no items and more than 30 items', () => {
    expect(() => buildProductMessage({ ...base, mode: 'products', items: [] })).toThrow(
      /at least one/,
    )
    const many = Array.from({ length: PRODUCT_LIST_MAX + 1 }, (_, i) =>
      item({ retailer_id: `p${i}` }),
    )
    expect(() => buildProductMessage({ ...base, mode: 'products', items: many })).toThrow(
      /at most 30/,
    )
  })

  it('accepts exactly 30 items', () => {
    const thirty = Array.from({ length: PRODUCT_LIST_MAX }, (_, i) =>
      item({ retailer_id: `p${i}` }),
    )
    const p = buildProductMessage({ ...base, mode: 'products', items: thirty })
    expect(validateInteractivePayload(p).ok).toBe(true)
  })
})
