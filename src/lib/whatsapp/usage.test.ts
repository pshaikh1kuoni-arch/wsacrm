import { describe, expect, it } from 'vitest'
import { formatMoney, summarizeUsage, usageWindow } from './usage'

describe('usageWindow', () => {
  it('covers the last 30 days up to now, in unix seconds', () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0)
    const { start, end } = usageWindow(now)
    expect(end).toBe(now / 1000)
    expect(end - start).toBe(30 * 24 * 60 * 60)
  })
})

describe('summarizeUsage', () => {
  it('adds volume and cost per message type', () => {
    const s = summarizeUsage(
      [
        { pricing_category: 'MARKETING', pricing_type: 'REGULAR', volume: 5, cost: 4 },
        { pricing_category: 'MARKETING', pricing_type: 'REGULAR', volume: 3, cost: 4 },
        { pricing_category: 'UTILITY', pricing_type: 'REGULAR', volume: 14, cost: 1.6 },
        { pricing_category: 'AUTHENTICATION', pricing_type: 'REGULAR', volume: 3, cost: 0.4 },
        { pricing_category: 'SERVICE', pricing_type: 'FREE_CUSTOMER_SERVICE', volume: 38, cost: 0 },
      ],
      'INR',
    )
    expect(s.currency).toBe('INR')
    expect(s.totalCost).toBe(10)
    expect(s.templatesSent).toBe(25)
    expect(s.freeService).toBe(38)
    expect(s.byType.map((r) => [r.type, r.messages, r.cost])).toEqual([
      ['marketing', 8, 8],
      ['utility', 14, 1.6],
      ['authentication', 3, 0.4],
      ['service', 38, 0],
    ])
  })

  it('removes float noise from the total', () => {
    const s = summarizeUsage(
      [
        { pricing_category: 'UTILITY', volume: 1, cost: 0.1 },
        { pricing_category: 'UTILITY', volume: 1, cost: 0.2 },
      ],
      'INR',
    )
    expect(s.totalCost).toBe(0.3)
  })

  it('shows an "other" row only when an unknown category has data', () => {
    const without = summarizeUsage([{ pricing_category: 'MARKETING', volume: 1, cost: 1 }], 'USD')
    expect(without.byType.some((r) => r.type === 'other')).toBe(false)

    const withOther = summarizeUsage(
      [{ pricing_category: 'MARKETING_LITE', volume: 2, cost: 0.5 }],
      'USD',
    )
    expect(withOther.byType.at(-1)).toEqual({ type: 'other', messages: 2, cost: 0.5 })
    expect(withOther.templatesSent).toBe(2)
    expect(withOther.totalCost).toBe(0.5)
  })

  it('returns zeros for no data', () => {
    const s = summarizeUsage([], null)
    expect(s.totalCost).toBe(0)
    expect(s.templatesSent).toBe(0)
    expect(s.freeService).toBe(0)
    expect(s.byType).toHaveLength(4)
  })

  it('treats missing, string and junk values safely', () => {
    const s = summarizeUsage(
      [
        { pricing_category: 'utility', volume: '4', cost: '0.46' },
        { pricing_category: 'UTILITY', volume: 'abc' },
        {},
      ],
      'INR',
    )
    expect(s.byType.find((r) => r.type === 'utility')).toEqual({
      type: 'utility',
      messages: 4,
      cost: 0.46,
    })
    expect(s.byType.find((r) => r.type === 'other')).toBeUndefined()
  })
})

describe('formatMoney', () => {
  it('formats rupees', () => {
    expect(formatMoney(10, 'INR', 'en-IN')).toBe('₹10.00')
  })
  it('keeps small per-message amounts readable', () => {
    expect(formatMoney(0.115, 'INR', 'en-IN')).toBe('₹0.115')
  })
  it('falls back to a plain number on a bad currency code', () => {
    expect(formatMoney(10, 'not-a-currency', 'en-US')).toBe('10.00 not-a-currency')
  })
  it('works without a currency', () => {
    expect(formatMoney(10, null)).toBe('10.00')
  })
})
