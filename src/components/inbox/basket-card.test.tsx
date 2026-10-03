import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { evaluateBasket, type BasketCatalogItem, type MetaOrder } from '@/lib/whatsapp/basket'
import { BasketCard } from './basket-card'

function messages(locale: string) {
  return JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'))
}

function render(locale: string, basket: ReturnType<typeof evaluateBasket>): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages(locale)}>
      <BasketCard basket={basket} />
    </NextIntlClientProvider>,
  )
}

const item = (over: Partial<BasketCatalogItem> & { retailer_id: string }): BasketCatalogItem => ({
  name: 'Magic Mug',
  size: null,
  color: null,
  price_amount: 300,
  sale_price_amount: 225,
  currency: 'INR',
  availability: 'in_stock',
  image_url: 'https://example.com/mug.jpg',
  ...over,
})

const catalog = new Map([
  ['mug', item({ retailer_id: 'mug' })],
  ['white', item({ retailer_id: 'white', name: 'White Mug', price_amount: 200, sale_price_amount: 149, image_url: null })],
  ['frame', item({ retailer_id: 'frame', name: 'Wooden Artistic Frames V1.2', price_amount: 1210, sale_price_amount: 968, size: '12x18in' })],
])

const order = (
  lines: { id: string; q: number; price?: number }[],
  text: string | null = null,
): MetaOrder => ({
  catalog_id: 'cat-1',
  text,
  product_items: lines.map((l) => ({
    product_retailer_id: l.id,
    quantity: l.q,
    item_price: l.price ?? null,
    currency: 'INR',
  })),
})

const okBasket = evaluateBasket(
  order([{ id: 'mug', q: 2, price: 225 }, { id: 'white', q: 1, price: 149 }], 'gift wrap please'),
  catalog,
)
const reviewBasket = evaluateBasket(
  order([{ id: 'frame', q: 1, price: 1150 }, { id: '482910_77', q: 1 }]),
  catalog,
)

describe('BasketCard', () => {
  it('shows what the customer picked, priced from the catalogue', () => {
    const html = render('en', okBasket)
    expect(html).toContain('Basket from customer')
    expect(html).toContain('Magic Mug')
    expect(html).toContain('₹225 each')
    // The normal price is struck through next to the sale price.
    expect(html).toMatch(/line-through[^>]*>₹300</)
    expect(html).toContain('x 2')
    expect(html).toContain('₹450')
    expect(html).toContain('White Mug')
    expect(html).toContain('Total from catalogue prices')
    expect(html).toContain('₹599')
    expect(html).toContain('All items match the catalogue. Needs follow up.')
    expect(html).toContain('gift wrap please')
  })

  it('says what is wrong and holds back the total', () => {
    const html = render('en', reviewBasket)
    expect(html).toContain('Wooden Artistic Frames V1.2')
    expect(html).toContain('12x18in')
    expect(html).toContain('Basket price ₹1,150. Catalogue price ₹968.')
    expect(html).toContain('Unknown item')
    expect(html).toContain('ID 482910_77. Not found in your catalogue.')
    expect(html).toContain('Total can not be confirmed')
    expect(html).toContain('₹968 so far')
    expect(html).toContain('Needs review. 2 issues.')
    expect(html).not.toContain('All items match')
  })

  it('uses the singular for one issue', () => {
    const one = evaluateBasket(order([{ id: '482910_77', q: 1 }]), catalog)
    expect(render('en', one)).toContain('Needs review. 1 issue.')
  })

  it('has every line translated in every language (no raw keys on screen)', () => {
    for (const locale of ['en', 'es', 'pt', 'ko']) {
      for (const basket of [okBasket, reviewBasket]) {
        const html = render(locale, basket)
        expect(html, locale).not.toContain('Catalog.basket')
        expect(html, locale).toContain('₹')
      }
    }
  })
})
