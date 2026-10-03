import { describe, expect, it } from 'vitest'
import {
  basketAutomationVars,
  basketIssueCount,
  basketNotification,
  basketSummary,
  evaluateBasket,
  parseOrder,
  pickBasketRecipients,
  type BasketCatalogItem,
  type MetaOrder,
} from './basket'

function cat(over: Partial<BasketCatalogItem> & { retailer_id: string }): BasketCatalogItem {
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

const catalog = new Map<string, BasketCatalogItem>([
  ['mug', cat({ retailer_id: 'mug' })],
  ['white', cat({ retailer_id: 'white', name: 'White Mug', price_amount: 200, sale_price_amount: 149 })],
  ['frame', cat({ retailer_id: 'frame', name: 'Frame', price_amount: 1210, sale_price_amount: 968, size: '12x18in' })],
  ['plain', cat({ retailer_id: 'plain', name: 'Plain', price_amount: 500, sale_price_amount: null })],
  ['gone', cat({ retailer_id: 'gone', name: 'Gone', availability: 'out_of_stock' })],
  ['free', cat({ retailer_id: 'free', name: 'No price', price_amount: null, sale_price_amount: null })],
])

function order(items: { id: string; q: number; price?: number | null }[], extra: Partial<MetaOrder> = {}): MetaOrder {
  return {
    catalog_id: 'cat-1',
    text: null,
    product_items: items.map((i) => ({
      product_retailer_id: i.id,
      quantity: i.q,
      item_price: i.price === undefined ? null : i.price,
      currency: 'INR',
    })),
    ...extra,
  }
}

describe('parseOrder', () => {
  it('reads Meta\'s order shape', () => {
    expect(
      parseOrder({
        catalog_id: 'cat-1',
        text: '  please pack as a gift  ',
        product_items: [
          { product_retailer_id: 'mug', quantity: 2, item_price: 225, currency: 'inr' },
          { product_retailer_id: ' white ', quantity: '1', item_price: '149.00', currency: 'INR' },
        ],
      }),
    ).toEqual({
      catalog_id: 'cat-1',
      text: 'please pack as a gift',
      product_items: [
        { product_retailer_id: 'mug', quantity: 2, item_price: 225, currency: 'INR' },
        { product_retailer_id: 'white', quantity: 1, item_price: 149, currency: 'INR' },
      ],
    })
  })

  it('returns null when there is nothing usable', () => {
    expect(parseOrder(undefined)).toBeNull()
    expect(parseOrder('x')).toBeNull()
    expect(parseOrder({})).toBeNull()
    expect(parseOrder({ product_items: [] })).toBeNull()
    expect(parseOrder({ product_items: [{ quantity: 1 }, null, 7] })).toBeNull()
  })

  it('skips an item with no ID but keeps the rest', () => {
    const o = parseOrder({
      product_items: [{ quantity: 1 }, { product_retailer_id: 'mug', quantity: 1 }],
    })
    expect(o?.product_items).toHaveLength(1)
    expect(o?.catalog_id).toBeNull()
    expect(o?.text).toBeNull()
  })

  it('reads a missing price as null', () => {
    const o = parseOrder({ product_items: [{ product_retailer_id: 'mug', quantity: 1 }] })
    expect(o?.product_items[0].item_price).toBeNull()
  })
})

describe('evaluateBasket', () => {
  it('prices from the catalogue and accepts the sale price', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 2, price: 225 }, { id: 'white', q: 1, price: 149 }]), catalog)
    expect(b.status).toBe('ok')
    expect(b.item_count).toBe(3)
    expect(b.total).toBe(599)
    expect(b.currency).toBe('INR')
    expect(b.items[0]).toMatchObject({
      name: 'Magic Mug',
      unit_price: 225,
      was_price: 300,
      line_total: 450,
      issues: [],
    })
  })

  it('also accepts the normal price in the basket, and still uses the sale price', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1, price: 300 }]), catalog)
    expect(b.status).toBe('ok')
    expect(b.items[0].issues).toEqual([])
    expect(b.total).toBe(225)
  })

  it('flags a basket price that matches neither price', () => {
    const b = evaluateBasket(order([{ id: 'frame', q: 1, price: 1150 }]), catalog)
    expect(b.status).toBe('needs_review')
    expect(b.items[0].issues).toEqual(['price_mismatch'])
    // The total still comes from the catalogue, never from the basket.
    expect(b.total).toBe(968)
    expect(b.items[0].basket_price).toBe(1150)
  })

  it('does not flag a price when the basket carries none', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }]), catalog)
    expect(b.items[0].issues).toEqual([])
  })

  it('flags an item that is not in the catalogue, and cannot confirm the total', () => {
    const b = evaluateBasket(order([{ id: 'frame', q: 1, price: 968 }, { id: '482910_77', q: 1 }]), catalog)
    expect(b.status).toBe('needs_review')
    expect(b.items[1]).toMatchObject({ name: null, unit_price: null, line_total: null })
    expect(b.items[1].issues).toEqual(['unknown_item'])
    expect(b.total).toBeNull()
    expect(b.total_known).toBe(968)
  })

  it('flags an out of stock item but still prices it', () => {
    const b = evaluateBasket(order([{ id: 'gone', q: 1 }]), catalog)
    expect(b.items[0].issues).toEqual(['out_of_stock'])
    expect(b.total).toBe(225)
  })

  it('flags an item that has no price in the catalogue', () => {
    const b = evaluateBasket(order([{ id: 'free', q: 1 }]), catalog)
    expect(b.items[0].issues).toEqual(['no_price'])
    expect(b.total).toBeNull()
  })

  it('flags a bad quantity and leaves that line unpriced', () => {
    for (const q of [0, -1, 1.5, 100, NaN]) {
      const b = evaluateBasket(order([{ id: 'mug', q }]), catalog)
      expect(b.items[0].issues).toContain('bad_quantity')
      expect(b.items[0].line_total).toBeNull()
      expect(b.total).toBeNull()
    }
  })

  it('accepts quantity 1 and 99', () => {
    expect(evaluateBasket(order([{ id: 'mug', q: 99 }]), catalog).items[0].line_total).toBe(22275)
    expect(evaluateBasket(order([{ id: 'mug', q: 1 }]), catalog).status).toBe('ok')
  })

  it('does not strike through a price when there is no sale', () => {
    const b = evaluateBasket(order([{ id: 'plain', q: 2 }]), catalog)
    expect(b.items[0]).toMatchObject({ unit_price: 500, was_price: null, line_total: 1000 })
  })

  it('marks every item when the catalogue lookup failed', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }]), new Map(), { lookupFailed: true })
    expect(b.items[0].issues).toEqual(['catalog_unavailable'])
    expect(b.status).toBe('needs_review')
    expect(b.total).toBeNull()
  })

  it('carries the customer note, the catalogue ID and the raw order', () => {
    const raw = { catalog_id: 'cat-1', product_items: [] }
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }], { text: 'gift wrap please' }), catalog, { raw })
    expect(b.customer_note).toBe('gift wrap please')
    expect(b.catalog_id).toBe('cat-1')
    expect(b.raw).toBe(raw)
  })

  it('adds up decimals without float noise', () => {
    const cheap = new Map([['x', cat({ retailer_id: 'x', price_amount: 0.1, sale_price_amount: null })]])
    const b = evaluateBasket(order([{ id: 'x', q: 3 }]), cheap)
    expect(b.total).toBe(0.3)
  })

  it('counts every problem on every line', () => {
    const b = evaluateBasket(
      order([{ id: 'gone', q: 1, price: 999 }, { id: 'nope', q: 1 }]),
      catalog,
    )
    expect(basketIssueCount(b)).toBe(3)
  })
})

describe('basketSummary', () => {
  it('gives the count and total', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 2 }, { id: 'white', q: 1 }]), catalog)
    expect(basketSummary(b)).toBe('Basket: 3 items, ₹599')
  })

  it('says item for a single unit', () => {
    expect(basketSummary(evaluateBasket(order([{ id: 'mug', q: 1 }]), catalog))).toBe(
      'Basket: 1 item, ₹225',
    )
  })

  it('says needs review and leaves the total out when it is unknown', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }, { id: 'nope', q: 1 }]), catalog)
    expect(basketSummary(b)).toBe('Basket: 2 items (needs review)')
  })
})

describe('basketNotification', () => {
  it('names the customer and the size of the basket', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 2 }]), catalog)
    expect(basketNotification('Rahul S.', b)).toEqual({
      title: 'Basket received',
      body: 'Rahul S. sent a basket of 2 items.',
    })
  })

  it('says when it needs review, and has a fallback name', () => {
    const b = evaluateBasket(order([{ id: 'nope', q: 1 }]), catalog)
    expect(basketNotification(null, b).body).toBe('A customer sent a basket of 1 item. It needs review.')
  })
})

describe('basketAutomationVars', () => {
  it('gives plain text for every variable', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 2 }, { id: 'frame', q: 1 }]), catalog)
    expect(basketAutomationVars('Rahul S.', b)).toEqual({
      name: 'Rahul S.',
      item_count: '3',
      items: '2 x Magic Mug\n1 x Frame (12x18in)',
      total: '₹1,418',
    })
  })

  it('says "there" when the customer has no name', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }]), catalog)
    expect(basketAutomationVars(null, b).name).toBe('there')
    expect(basketAutomationVars('   ', b).name).toBe('there')
  })

  it('shows the item ID for an item the catalogue does not know, and never states a wrong total', () => {
    const b = evaluateBasket(order([{ id: 'mug', q: 1 }, { id: 'nope', q: 2 }]), catalog)
    const vars = basketAutomationVars('Rahul', b)
    expect(vars.items).toBe('1 x Magic Mug\n2 x Item nope')
    expect(vars.total).toBe('to be confirmed')
  })
})

describe('pickBasketRecipients', () => {
  const members = [
    { user_id: 'o', account_role: 'owner' },
    { user_id: 'a', account_role: 'admin' },
    { user_id: 'g', account_role: 'agent' },
    { user_id: 'v', account_role: 'viewer' },
    { user_id: 'g', account_role: 'agent' },
  ]

  it('tells only the assigned agent when there is one', () => {
    expect(pickBasketRecipients('g', members)).toEqual(['g'])
  })

  it('tells everyone who can answer, and never viewers, when nobody is assigned', () => {
    expect(pickBasketRecipients(null, members)).toEqual(['o', 'a', 'g'])
    expect(pickBasketRecipients(undefined, members)).toEqual(['o', 'a', 'g'])
  })

  it('returns nobody when there is nobody to tell', () => {
    expect(pickBasketRecipients(null, [{ user_id: 'v', account_role: 'viewer' }])).toEqual([])
    expect(pickBasketRecipients(null, [])).toEqual([])
  })
})
