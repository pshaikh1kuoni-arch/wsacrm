import { describe, expect, it } from 'vitest'

import {
  addOneMonth,
  computeAccessUntil,
  formatRupees,
  maskPaymentId,
  PLAN,
  subscriptionState,
} from './plan'

const d = (iso: string) => new Date(iso)

describe('PLAN', () => {
  it('is 2,500 rupees in paise', () => {
    expect(PLAN.amountPaise).toBe(250000)
    expect(PLAN.currency).toBe('INR')
  })
})

describe('addOneMonth', () => {
  it('adds a calendar month', () => {
    expect(addOneMonth(d('2026-10-03T10:00:00Z')).toISOString()).toBe('2026-11-03T10:00:00.000Z')
  })

  it('rolls the year over in December', () => {
    expect(addOneMonth(d('2026-12-15T00:00:00Z')).toISOString()).toBe('2027-01-15T00:00:00.000Z')
  })

  it('clamps the 31st to the end of a shorter month', () => {
    expect(addOneMonth(d('2026-01-31T09:30:00Z')).toISOString()).toBe('2026-02-28T09:30:00.000Z')
    expect(addOneMonth(d('2028-01-31T09:30:00Z')).toISOString()).toBe('2028-02-29T09:30:00.000Z')
    expect(addOneMonth(d('2026-03-31T00:00:00Z')).toISOString()).toBe('2026-04-30T00:00:00.000Z')
  })
})

describe('computeAccessUntil', () => {
  const paidAt = d('2026-10-03T10:00:00Z')

  it('starts from the payment time when nothing was paid before', () => {
    expect(computeAccessUntil(null, paidAt).toISOString()).toBe('2026-11-03T10:00:00.000Z')
  })

  it('starts from the payment time when the old access already ended', () => {
    expect(computeAccessUntil(d('2026-09-01T00:00:00Z'), paidAt).toISOString()).toBe(
      '2026-11-03T10:00:00.000Z',
    )
  })

  it('stacks on the time still left when paying early', () => {
    expect(computeAccessUntil(d('2026-10-20T00:00:00Z'), paidAt).toISOString()).toBe(
      '2026-11-20T00:00:00.000Z',
    )
  })
})

describe('subscriptionState', () => {
  const now = d('2026-10-03T10:00:00Z')

  it('is not_paid with no payment', () => {
    expect(subscriptionState(null, now)).toBe('not_paid')
  })
  it('is active before the date and expired after', () => {
    expect(subscriptionState(d('2026-10-04T00:00:00Z'), now)).toBe('active')
    expect(subscriptionState(d('2026-10-02T00:00:00Z'), now)).toBe('expired')
  })
})

describe('formatRupees', () => {
  it('formats whole rupees with Indian grouping', () => {
    expect(formatRupees(250000)).toBe('₹2,500')
    expect(formatRupees(10000000)).toBe('₹1,00,000')
  })
  it('shows paise only when present', () => {
    expect(formatRupees(250050)).toBe('₹2,500.50')
  })
})

describe('maskPaymentId', () => {
  it('hides the middle of a payment id', () => {
    expect(maskPaymentId('pay_QxAbCdEf8Kd')).toBe('pay_Qx••••8Kd')
  })
  it('leaves a short id alone', () => {
    expect(maskPaymentId('pay_1')).toBe('pay_1')
  })
})
