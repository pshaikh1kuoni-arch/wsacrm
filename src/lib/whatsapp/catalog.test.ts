import { describe, expect, it } from 'vitest'
import {
  effectivePrice,
  explainCatalogError,
  formatCatalogPrice,
  normalizeAvailability,
  parsePriceAmount,
  toCatalogRow,
  variantLabel,
} from './catalog'

describe('parsePriceAmount', () => {
  it('reads the rupee text Meta returns', () => {
    expect(parsePriceAmount('₹1,210.00')).toBe(1210)
    expect(parsePriceAmount('₹300.00')).toBe(300)
    expect(parsePriceAmount('₹149.00')).toBe(149)
  })

  it('reads Indian digit grouping', () => {
    expect(parsePriceAmount('₹1,21,000.00')).toBe(121000)
  })

  it('reads a comma as the decimal mark when the dot comes first', () => {
    expect(parsePriceAmount('1.210,50 €')).toBe(1210.5)
  })

  it('treats a lone comma with two digits after it as a decimal mark', () => {
    expect(parsePriceAmount('12,50')).toBe(12.5)
  })

  it('treats a lone comma with three digits after it as a thousands mark', () => {
    expect(parsePriceAmount('₹1,210')).toBe(1210)
  })

  it('ignores currency letters', () => {
    expect(parsePriceAmount('INR 300')).toBe(300)
  })

  it('returns null when there is no number', () => {
    expect(parsePriceAmount('')).toBeNull()
    expect(parsePriceAmount(undefined)).toBeNull()
    expect(parsePriceAmount('free')).toBeNull()
  })
})

describe('normalizeAvailability', () => {
  it('maps the two states that matter', () => {
    expect(normalizeAvailability('in stock')).toBe('in_stock')
    expect(normalizeAvailability('out of stock')).toBe('out_of_stock')
  })

  it('ignores case and underscores', () => {
    expect(normalizeAvailability('IN_STOCK')).toBe('in_stock')
    expect(normalizeAvailability('Out Of Stock')).toBe('out_of_stock')
  })

  it('puts everything else under other', () => {
    expect(normalizeAvailability('preorder')).toBe('other')
    expect(normalizeAvailability(undefined)).toBe('other')
  })
})

describe('toCatalogRow', () => {
  const NOW = '2026-10-02T12:00:00.000Z'

  it('builds a row from a real item', () => {
    const row = toCatalogRow(
      'acc-1',
      'cat-1',
      {
        id: '26424437707156671',
        retailer_id: '13738612713_2713',
        retailer_product_group_id: '13738612713_2713',
        name: 'Wooden Artistic Frames V1.2',
        price: '₹1,210.00',
        sale_price: '₹968.00',
        currency: 'inr',
        availability: 'in stock',
        image_url: 'https://example.com/a.jpg',
        url: 'https://example.com/p',
        size: ' 12x18in ',
        color: 'Black',
      },
      NOW,
    )
    expect(row).toEqual({
      account_id: 'acc-1',
      catalog_id: 'cat-1',
      retailer_id: '13738612713_2713',
      meta_item_id: '26424437707156671',
      group_id: '13738612713_2713',
      name: 'Wooden Artistic Frames V1.2',
      price_amount: 1210,
      sale_price_amount: 968,
      currency: 'INR',
      availability: 'in_stock',
      image_url: 'https://example.com/a.jpg',
      product_url: 'https://example.com/p',
      size: '12x18in',
      color: 'Black',
      synced_at: NOW,
    })
  })

  it('leaves optional fields null', () => {
    const row = toCatalogRow('a', 'c', { retailer_id: 'r1', name: 'Mug' }, NOW)
    expect(row?.price_amount).toBeNull()
    expect(row?.sale_price_amount).toBeNull()
    expect(row?.currency).toBeNull()
    expect(row?.group_id).toBeNull()
    expect(row?.size).toBeNull()
    expect(row?.color).toBeNull()
    expect(row?.availability).toBe('other')
  })

  it('skips an item with no retailer ID or no name', () => {
    expect(toCatalogRow('a', 'c', { name: 'Mug' }, NOW)).toBeNull()
    expect(toCatalogRow('a', 'c', { retailer_id: '  ', name: 'Mug' }, NOW)).toBeNull()
    expect(toCatalogRow('a', 'c', { retailer_id: 'r1' }, NOW)).toBeNull()
  })
})

describe('effectivePrice', () => {
  it('uses the sale price when it is lower', () => {
    expect(effectivePrice({ price_amount: 300, sale_price_amount: 225 })).toBe(225)
  })

  it('uses the normal price when there is no sale price', () => {
    expect(effectivePrice({ price_amount: 300, sale_price_amount: null })).toBe(300)
  })

  it('ignores a sale price that is not lower', () => {
    expect(effectivePrice({ price_amount: 300, sale_price_amount: 300 })).toBe(300)
    expect(effectivePrice({ price_amount: 300, sale_price_amount: 400 })).toBe(300)
  })

  it('uses the sale price when the normal price is missing', () => {
    expect(effectivePrice({ price_amount: null, sale_price_amount: 225 })).toBe(225)
  })

  it('returns null when there is no price at all', () => {
    expect(effectivePrice({ price_amount: null, sale_price_amount: null })).toBeNull()
  })
})

describe('explainCatalogError', () => {
  it('names the missing catalogue permission', () => {
    const r = explainCatalogError({
      message: '(#100) This application has not been approved to use this api.',
      code: 100,
      fbtraceId: 'abc',
    })
    expect(r.summary).toContain('catalog_management')
    expect(r.httpStatus).toBe(400)
    expect(r.side).toBe('user')
    expect(r.fbtraceId).toBe('abc')
  })

  it('asks for a new token on an expired one', () => {
    const r = explainCatalogError({ message: 'Error validating access token', code: 190 })
    expect(r.summary).toMatch(/new token/i)
    expect(r.httpStatus).toBe(400)
  })

  it('says to wait when Meta rate limits', () => {
    expect(explainCatalogError({ message: 'x', code: 4 }).summary).toMatch(/wait/i)
    expect(explainCatalogError({ message: 'x', httpStatus: 429 }).httpStatus).toBe(502)
  })

  it('falls back to a plain message', () => {
    const r = explainCatalogError({ message: 'boom', code: 1 })
    expect(r.side).toBe('meta')
    expect(r.metaMessage).toBe('boom')
  })
})

describe('variantLabel', () => {
  it('joins size and colour', () => {
    expect(variantLabel({ size: 'L', color: 'Black' })).toBe('L · Black')
  })

  it('shows whichever one exists', () => {
    expect(variantLabel({ size: 'A4', color: null })).toBe('A4')
    expect(variantLabel({ size: null, color: 'Red' })).toBe('Red')
  })

  it('is empty when there is neither', () => {
    expect(variantLabel({ size: null, color: null })).toBe('')
    expect(variantLabel({ size: ' ', color: undefined })).toBe('')
  })
})

describe('formatCatalogPrice', () => {
  it('drops the decimals on a whole amount', () => {
    expect(formatCatalogPrice(1210, 'INR')).toBe('₹1,210')
    expect(formatCatalogPrice(225, 'INR')).toBe('₹225')
  })

  it('keeps two decimals otherwise', () => {
    expect(formatCatalogPrice(149.5, 'INR')).toBe('₹149.50')
  })

  it('falls back to a plain number without a currency', () => {
    expect(formatCatalogPrice(300, null)).toBe('300')
  })

  it('does not throw on a currency code Intl does not know', () => {
    expect(formatCatalogPrice(5, 'NOPE!')).toContain('5')
  })
})
