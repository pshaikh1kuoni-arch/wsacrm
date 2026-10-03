import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'

import type { PickerItem } from '@/lib/whatsapp/product-message'
import { ProductRow } from './product-picker'

const item = (over: Partial<PickerItem> = {}): PickerItem => ({
  retailer_id: '2008',
  name: 'Glitter Mug',
  size: null,
  color: 'Gold',
  price_amount: 399,
  sale_price_amount: 299,
  currency: 'INR',
  availability: 'in_stock',
  image_url: null,
  ...over,
})

function row(over: Partial<PickerItem> = {}, extra: { checked?: boolean; disabled?: boolean } = {}): string {
  return renderToStaticMarkup(
    React.createElement(ProductRow, {
      item: item(over),
      checked: extra.checked ?? false,
      disabled: extra.disabled ?? false,
      onToggle: () => {},
      outOfStockLabel: 'Out of stock',
      notReadyLabel: 'Not ready on WhatsApp yet',
      notReadyTooltip: 'Meta has not approved this product yet.',
    }),
  )
}

describe('ProductRow: not ready on WhatsApp', () => {
  it('shows the amber tag with its explanation on an outdated product', () => {
    const html = row({ whatsapp_status: 'outdated' })
    expect(html).toContain('Not ready on WhatsApp yet')
    expect(html).toContain('title="Meta has not approved this product yet."')
    expect(html).toContain('amber')
  })

  it('also shows it for a status Meta added that we do not recognise', () => {
    expect(row({ whatsapp_status: 'other' })).toContain('Not ready on WhatsApp yet')
  })

  it('shows no tag on an approved, never reviewed or unknown product', () => {
    expect(row({ whatsapp_status: 'approved' })).not.toContain('Not ready on WhatsApp yet')
    expect(row({ whatsapp_status: 'no_review' })).not.toContain('Not ready on WhatsApp yet')
    expect(row({ whatsapp_status: null })).not.toContain('Not ready on WhatsApp yet')
    expect(row({})).not.toContain('Not ready on WhatsApp yet')
  })

  it('only warns: the row can still be ticked', () => {
    expect(row({ whatsapp_status: 'outdated' })).not.toContain('disabled')
  })

  it('keeps the name, ID, price and sale price on the row', () => {
    const html = row({ whatsapp_status: 'outdated' })
    expect(html).toContain('Glitter Mug')
    expect(html).toContain('#2008')
    expect(html).toContain('₹299')
    expect(html).toContain('₹399')
  })

  it('keeps an out of stock product disabled, as before', () => {
    const html = row({ availability: 'out_of_stock' }, { disabled: true })
    expect(html).toContain('disabled')
    expect(html).toContain('Out of stock')
  })
})

describe('the warning note, in every language', () => {
  function t(locale: string) {
    const messages = JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'))
    return createTranslator({ locale, messages, namespace: 'Catalog.picker' })
  }

  it('reads correctly in English for one and for several products', () => {
    const en = t('en')
    expect(en('notReadyTitleSingle')).toBe('This product is not ready on WhatsApp yet.')
    expect(en('notReadyTitle', { notReady: 1, count: 2 })).toBe(
      '1 of the 2 selected products is not ready on WhatsApp yet.',
    )
    expect(en('notReadyTitle', { notReady: 2, count: 3 })).toBe(
      '2 of the 3 selected products are not ready on WhatsApp yet.',
    )
    expect(en('notReadyHint', { notReady: 1 })).toBe('Your customer may not see it. You can still send.')
    expect(en('notReadyHint', { notReady: 2 })).toBe('Your customer may not see them. You can still send.')
  })

  it('fills in the numbers in all four languages', () => {
    for (const locale of ['en', 'es', 'pt', 'ko']) {
      const tr = t(locale)
      const title = tr('notReadyTitle', { notReady: 2, count: 5 })
      expect(title, locale).toContain('2')
      expect(title, locale).toContain('5')
      expect(title, locale).not.toContain('{')
      expect(tr('notReadyHint', { notReady: 1 }), locale).not.toContain('{')
      expect(tr('notReadyTag'), locale).toBeTruthy()
      expect(tr('notReadyTooltip'), locale).toBeTruthy()
    }
  })
})
