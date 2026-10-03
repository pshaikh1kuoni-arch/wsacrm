// ============================================================
// Razorpay signature checks — pure, no I/O.
//
// Two different signatures exist, and they are NOT interchangeable:
//
//   1. Checkout signature. After a customer pays in Razorpay
//      Checkout, the browser gets { order_id, payment_id, signature }.
//      signature = HMAC-SHA256(`${order_id}|${payment_id}`, KEY SECRET).
//      The browser is untrusted, so the server recomputes it.
//
//   2. Webhook signature. Razorpay signs the RAW request body with the
//      webhook secret you typed in the dashboard and sends it in the
//      `X-Razorpay-Signature` header. Verify against the raw text, not
//      a re-serialised JSON object.
//
// Both compare in constant time.
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto'

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyCheckoutSignature(args: {
  orderId: string
  paymentId: string
  signature: string
  secret: string
}): boolean {
  const { orderId, paymentId, signature, secret } = args
  if (!orderId || !paymentId || !signature || !secret) return false
  const expected = hmacHex(secret, `${orderId}|${paymentId}`)
  return safeEqual(expected, signature.trim().toLowerCase())
}

export function verifyWebhookSignature(args: {
  rawBody: string
  signature: string
  secret: string
}): boolean {
  const { rawBody, signature, secret } = args
  if (!rawBody || !signature || !secret) return false
  return safeEqual(hmacHex(secret, rawBody), signature.trim().toLowerCase())
}
