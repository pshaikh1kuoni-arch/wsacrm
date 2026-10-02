import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { InteractiveMessagePayload } from '@/lib/whatsapp/interactive'
import { InteractivePreview } from './interactive-preview'

const html = (payload: InteractiveMessagePayload, labels?: Parameters<typeof InteractivePreview>[0]['labels']) =>
  renderToStaticMarkup(React.createElement(InteractivePreview, { payload, labels }))

const display = (id: string, name: string, extra: Record<string, string> = {}) => ({
  retailer_id: id,
  name,
  price_text: '₹225',
  ...extra,
})

describe('InteractivePreview: product messages', () => {
  it('draws a single product with its variant, sale price and normal price', () => {
    const out = html({
      kind: 'product',
      body: 'This one is popular.',
      catalog_id: 'c',
      retailer_id: 'r1',
      display: display('r1', 'Magic Mug', { variant: 'Black', was_text: '₹300', image_url: 'https://example.com/m.jpg' }),
    })
    expect(out).toContain('This one is popular.')
    expect(out).toContain('Magic Mug')
    expect(out).toContain('Black')
    expect(out).toContain('₹225')
    expect(out).toMatch(/line-through[^>]*>₹300</)
    expect(out).toContain('https://example.com/m.jpg')
    expect(out).toContain('View')
  })

  it('draws a product with no saved snapshot without breaking', () => {
    const out = html({ kind: 'product', body: 'Hi', catalog_id: 'c', retailer_id: 'r1' })
    expect(out).toContain('Hi')
    expect(out).toContain('View')
  })

  it('draws a product list: the header, three rows and how many more', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const out = html(
      {
        kind: 'product_list',
        body: 'Here are a few options.',
        header: 'Our mugs',
        catalog_id: 'c',
        sections: [{ title: 'Our mugs', retailer_ids: ids }],
        display: ids.map((id) => display(id, `Mug ${id}`)),
      },
      { more: (n) => `${n} more products`, viewItems: 'Open the list' },
    )
    expect(out).toContain('Our mugs')
    expect(out).toContain('Mug a')
    expect(out).toContain('Mug c')
    expect(out).not.toContain('Mug d')
    expect(out).toContain('2 more products')
    expect(out).toContain('Open the list')
  })

  it('does not say "more" when every product fits', () => {
    const out = html({
      kind: 'product_list',
      body: 'Two options.',
      header: 'Pair',
      catalog_id: 'c',
      sections: [{ title: 'Pair', retailer_ids: ['a', 'b'] }],
      display: [display('a', 'Mug a'), display('b', 'Mug b')],
    })
    expect(out).not.toContain('more')
  })

  it('counts products that have no snapshot as "more"', () => {
    const out = html({
      kind: 'product_list',
      body: 'List',
      header: 'List',
      catalog_id: 'c',
      sections: [{ title: 'List', retailer_ids: ['a', 'b', 'c', 'd'] }],
    })
    expect(out).toContain('+4 more')
  })

  it('draws the catalogue message with its button', () => {
    const out = html({ kind: 'catalog', body: 'Browse our catalogue.', footer: 'Prices in INR' }, { viewCatalogue: 'Open catalogue' })
    expect(out).toContain('Browse our catalogue.')
    expect(out).toContain('Prices in INR')
    expect(out).toContain('Open catalogue')
  })

  it('still draws the older kinds', () => {
    const out = html({ kind: 'buttons', body: 'Pick', buttons: [{ id: 'y', title: 'Yes' }] })
    expect(out).toContain('Yes')
  })
})
