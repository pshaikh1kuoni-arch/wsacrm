import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

import { RazorpayError, type RazorpayConfig, type RazorpayPayment } from '@/lib/razorpay/client'

import { confirmBillingPayment } from './confirm'
import { createMemoryRepo } from './memory-repo.test-util'
import { PLAN } from './plan'
import { startBillingPayment } from './start'

const CONFIG: RazorpayConfig = { keyId: 'rzp_test_k', keySecret: 'shh', testMode: true }
const ACCOUNT = 'acct-1'
const USER = 'user-1'
const NOW = new Date('2026-10-03T10:00:00Z')

function sign(orderId: string, paymentId: string, secret = CONFIG.keySecret): string {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}

function goodPayment(orderId: string, overrides: Partial<RazorpayPayment> = {}): RazorpayPayment {
  return {
    id: 'pay_1',
    order_id: orderId,
    amount: PLAN.amountPaise,
    currency: PLAN.currency,
    status: 'captured',
    ...overrides,
  }
}

async function setup(paymentOverrides: Partial<RazorpayPayment> = {}) {
  const repo = createMemoryRepo()
  const { order } = await startBillingPayment(
    {
      repo,
      config: CONFIG,
      createOrder: vi.fn().mockResolvedValue({
        id: 'order_1',
        amount: PLAN.amountPaise,
        currency: 'INR',
        receipt: 'WAG-000001',
        status: 'created',
      }),
    },
    { accountId: ACCOUNT, userId: USER },
  )
  const fetchPayment = vi.fn().mockResolvedValue(goodPayment(order.id, paymentOverrides))
  const deps = { repo, config: CONFIG, fetchPayment, now: () => NOW }
  const input = {
    accountId: ACCOUNT,
    orderId: order.id,
    paymentId: 'pay_1',
    signature: sign(order.id, 'pay_1'),
  }
  return { repo, deps, input, fetchPayment }
}

describe('startBillingPayment', () => {
  it('records the attempt with the receipt and attaches the Razorpay order', async () => {
    const repo = createMemoryRepo()
    const createOrder = vi.fn().mockResolvedValue({
      id: 'order_9',
      amount: 250000,
      currency: 'INR',
      receipt: 'WAG-000001',
      status: 'created',
    })

    const { row, order } = await startBillingPayment(
      { repo, config: CONFIG, createOrder },
      { accountId: ACCOUNT, userId: USER },
    )

    expect(createOrder).toHaveBeenCalledWith(
      CONFIG,
      expect.objectContaining({ amountPaise: 250000, receipt: row.receipt }),
    )
    expect(order.id).toBe('order_9')
    expect(repo.rows[0].razorpay_order_id).toBe('order_9')
    expect(repo.rows[0].status).toBe('created')
  })

  it('marks the attempt failed when Razorpay refuses the order', async () => {
    const repo = createMemoryRepo()
    const createOrder = vi.fn().mockRejectedValue(new RazorpayError('nope', 400))

    await expect(
      startBillingPayment({ repo, config: CONFIG, createOrder }, { accountId: ACCOUNT, userId: USER }),
    ).rejects.toBeInstanceOf(RazorpayError)

    expect(repo.rows).toHaveLength(1)
    expect(repo.rows[0].status).toBe('failed')
  })
})

describe('confirmBillingPayment', () => {
  it('settles a captured payment for the right amount and adds one month', async () => {
    const { deps, input, repo } = await setup()

    const result = await confirmBillingPayment(deps, input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.alreadyPaid).toBe(false)
    expect(result.row.status).toBe('paid')
    expect(result.row.access_until).toBe('2026-11-03T10:00:00.000Z')
    expect(repo.rows[0].razorpay_payment_id).toBe('pay_1')
  })

  it('rejects a bad signature without calling Razorpay', async () => {
    const { deps, input, fetchPayment, repo } = await setup()

    const result = await confirmBillingPayment(deps, { ...input, signature: sign(input.orderId, 'pay_1', 'wrong') })

    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
    expect(fetchPayment).not.toHaveBeenCalled()
    expect(repo.rows[0].status).toBe('created')
  })

  it('rejects an order that belongs to another account', async () => {
    const { deps, input } = await setup()
    const result = await confirmBillingPayment(deps, { ...input, accountId: 'someone-else' })
    expect(result).toEqual({ ok: false, reason: 'unknown_order' })
  })

  it('rejects a payment for the wrong amount', async () => {
    const { deps, input, repo } = await setup({ amount: 100 })
    const result = await confirmBillingPayment(deps, input)
    expect(result).toEqual({ ok: false, reason: 'amount_mismatch' })
    expect(repo.rows[0].status).toBe('created')
  })

  it('rejects a payment that is not captured yet', async () => {
    const { deps, input, repo } = await setup({ status: 'authorized' })
    const result = await confirmBillingPayment(deps, input)
    expect(result).toEqual({ ok: false, reason: 'not_captured' })
    expect(repo.rows[0].status).toBe('created')
  })

  it('rejects a payment that belongs to a different Razorpay order', async () => {
    const { deps, input } = await setup({ order_id: 'order_other' })
    const result = await confirmBillingPayment(deps, input)
    expect(result).toEqual({ ok: false, reason: 'payment_mismatch' })
  })

  it('treats a payment Razorpay does not know as a mismatch', async () => {
    const { deps, input } = await setup()
    deps.fetchPayment.mockRejectedValue(new RazorpayError('not found', 404))
    const result = await confirmBillingPayment(deps, input)
    expect(result).toEqual({ ok: false, reason: 'payment_mismatch' })
  })

  it('reports Razorpay being unavailable without settling', async () => {
    const { deps, input, repo } = await setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    deps.fetchPayment.mockRejectedValue(new RazorpayError('down', 503))
    const result = await confirmBillingPayment(deps, input)
    expect(result).toEqual({ ok: false, reason: 'razorpay_unavailable' })
    expect(repo.rows[0].status).toBe('created')
  })

  it('is safe to confirm twice: access is extended only once', async () => {
    const { deps, input, repo } = await setup()

    const first = await confirmBillingPayment(deps, input)
    const second = await confirmBillingPayment(deps, input)

    expect(first.ok && !first.alreadyPaid).toBe(true)
    expect(second.ok && second.alreadyPaid).toBe(true)
    expect(repo.rows[0].access_until).toBe('2026-11-03T10:00:00.000Z')
  })

  it('refuses a second, different payment id against a paid order', async () => {
    const { deps, input } = await setup()
    await confirmBillingPayment(deps, input)

    const result = await confirmBillingPayment(deps, {
      ...input,
      paymentId: 'pay_2',
      signature: sign(input.orderId, 'pay_2'),
    })

    expect(result).toEqual({ ok: false, reason: 'payment_mismatch' })
  })

  it('stacks a new month on top of time that is still left', async () => {
    const { deps, input, repo } = await setup()
    repo.rows.push({
      id: 'old',
      account_id: ACCOUNT,
      receipt: 'WAG-OLD',
      razorpay_order_id: 'order_old',
      razorpay_payment_id: 'pay_old',
      amount_paise: PLAN.amountPaise,
      currency: 'INR',
      status: 'paid',
      access_until: '2026-10-20T00:00:00.000Z',
      created_at: '2026-09-20T00:00:00.000Z',
      paid_at: '2026-09-20T00:00:00.000Z',
    })

    const result = await confirmBillingPayment(deps, input)

    expect(result.ok && result.row.access_until).toBe('2026-11-20T00:00:00.000Z')
  })
})
