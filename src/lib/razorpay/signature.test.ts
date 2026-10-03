import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { verifyCheckoutSignature, verifyWebhookSignature } from './signature'

const SECRET = 'test_secret_value'

function sign(message: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

describe('verifyCheckoutSignature', () => {
  const orderId = 'order_ABC123'
  const paymentId = 'pay_XYZ789'

  it('accepts the signature Razorpay would produce', () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: sign(`${orderId}|${paymentId}`),
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('accepts an upper case hex signature', () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: sign(`${orderId}|${paymentId}`).toUpperCase(),
        secret: SECRET,
      }),
    ).toBe(true)
  })

  it('rejects a signature made with the wrong secret', () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId,
        signature: sign(`${orderId}|${paymentId}`, 'other_secret'),
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('rejects when the payment id was swapped', () => {
    expect(
      verifyCheckoutSignature({
        orderId,
        paymentId: 'pay_OTHER',
        signature: sign(`${orderId}|${paymentId}`),
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('rejects when the order id was swapped', () => {
    expect(
      verifyCheckoutSignature({
        orderId: 'order_OTHER',
        paymentId,
        signature: sign(`${orderId}|${paymentId}`),
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('rejects empty or missing parts without throwing', () => {
    const good = sign(`${orderId}|${paymentId}`)
    expect(verifyCheckoutSignature({ orderId: '', paymentId, signature: good, secret: SECRET })).toBe(false)
    expect(verifyCheckoutSignature({ orderId, paymentId: '', signature: good, secret: SECRET })).toBe(false)
    expect(verifyCheckoutSignature({ orderId, paymentId, signature: '', secret: SECRET })).toBe(false)
    expect(verifyCheckoutSignature({ orderId, paymentId, signature: good, secret: '' })).toBe(false)
  })

  it('rejects a signature of the wrong length without throwing', () => {
    expect(
      verifyCheckoutSignature({ orderId, paymentId, signature: 'abc', secret: SECRET }),
    ).toBe(false)
  })
})

describe('verifyWebhookSignature', () => {
  const rawBody = JSON.stringify({ event: 'payment_link.paid', payload: {} })

  it('accepts the signature of the raw body', () => {
    expect(
      verifyWebhookSignature({ rawBody, signature: sign(rawBody), secret: SECRET }),
    ).toBe(true)
  })

  it('rejects a body that was changed after signing', () => {
    expect(
      verifyWebhookSignature({
        rawBody: rawBody + ' ',
        signature: sign(rawBody),
        secret: SECRET,
      }),
    ).toBe(false)
  })

  it('rejects a missing signature or body', () => {
    expect(verifyWebhookSignature({ rawBody, signature: '', secret: SECRET })).toBe(false)
    expect(verifyWebhookSignature({ rawBody: '', signature: sign(rawBody), secret: SECRET })).toBe(false)
  })
})
