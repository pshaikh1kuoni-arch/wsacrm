import { describe, expect, it, vi } from 'vitest'

import {
  createOrder,
  fetchPayment,
  getRazorpayConfig,
  RazorpayError,
  type RazorpayConfig,
} from './client'

const CONFIG: RazorpayConfig = {
  keyId: 'rzp_test_abc',
  keySecret: 'secret123',
  testMode: true,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getRazorpayConfig', () => {
  it('returns null when a key is missing', () => {
    expect(getRazorpayConfig({})).toBeNull()
    expect(getRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_a' })).toBeNull()
    expect(getRazorpayConfig({ RAZORPAY_KEY_SECRET: 's' })).toBeNull()
    expect(getRazorpayConfig({ RAZORPAY_KEY_ID: '  ', RAZORPAY_KEY_SECRET: 's' })).toBeNull()
  })

  it('detects test mode from the key id prefix', () => {
    expect(
      getRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_a', RAZORPAY_KEY_SECRET: 's' })?.testMode,
    ).toBe(true)
    expect(
      getRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_live_a', RAZORPAY_KEY_SECRET: 's' })?.testMode,
    ).toBe(false)
  })
})

describe('createOrder', () => {
  it('posts the amount in paise with basic auth and returns the order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 'order_1', amount: 250000, currency: 'INR', receipt: 'WAG-000001', status: 'created' }),
    )

    const order = await createOrder(
      CONFIG,
      { amountPaise: 250000, receipt: 'WAG-000001', notes: { account: 'a1' } },
      fetchMock as unknown as typeof fetch,
    )

    expect(order.id).toBe('order_1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/orders')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('rzp_test_abc:secret123').toString('base64')}`,
    )
    expect(JSON.parse(init.body)).toEqual({
      amount: 250000,
      currency: 'INR',
      receipt: 'WAG-000001',
      notes: { account: 'a1' },
    })
  })

  it('turns a Razorpay error into a RazorpayError with its description', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'BAD_REQUEST_ERROR', description: 'Amount must be at least 100' } }, 400),
    )

    await expect(
      createOrder(CONFIG, { amountPaise: 1, receipt: 'r' }, fetchMock as unknown as typeof fetch),
    ).rejects.toMatchObject({
      name: 'RazorpayError',
      status: 400,
      code: 'BAD_REQUEST_ERROR',
      message: 'Amount must be at least 100',
    })
  })

  it('throws a RazorpayError when the answer is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('oops', { status: 502 }))
    await expect(
      createOrder(CONFIG, { amountPaise: 100, receipt: 'r' }, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(RazorpayError)
  })
})

describe('fetchPayment', () => {
  it('reads the payment by id and encodes the id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 'pay_1', order_id: 'order_1', amount: 250000, currency: 'INR', status: 'captured' }),
    )

    const payment = await fetchPayment(CONFIG, 'pay_1', fetchMock as unknown as typeof fetch)

    expect(payment.status).toBe('captured')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.razorpay.com/v1/payments/pay_1')
    expect(fetchMock.mock.calls[0][1].method).toBe('GET')
  })

  it('does not let an id add path segments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'x' }))
    await fetchPayment(CONFIG, '../orders', fetchMock as unknown as typeof fetch)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.razorpay.com/v1/payments/..%2Forders')
  })
})
