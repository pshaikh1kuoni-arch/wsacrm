// ============================================================
// Settling a subscription payment.
//
// The browser tells us "I paid" after Razorpay Checkout closes. That
// claim is worth nothing on its own, so a payment counts as paid only
// when ALL of these hold:
//
//   1. The checkout signature matches (HMAC with the key secret).
//   2. The order is one we created, for this account.
//   3. Razorpay itself says the payment exists, belongs to that order,
//      is captured, and is for exactly the amount we asked for.
//
// Settling is idempotent: a repeated or racing request returns the
// already-paid row and extends access only once.
// ============================================================

import {
  fetchPayment as defaultFetchPayment,
  RazorpayError,
  type RazorpayConfig,
  type RazorpayPayment,
} from '@/lib/razorpay/client'
import { verifyCheckoutSignature } from '@/lib/razorpay/signature'

import { computeAccessUntil } from './plan'
import type { BillingPaymentRow, BillingRepo } from './repo'

export type ConfirmFailure =
  | 'bad_signature'
  | 'unknown_order'
  | 'payment_mismatch'
  | 'amount_mismatch'
  | 'not_captured'
  | 'razorpay_unavailable'

export type ConfirmResult =
  | { ok: true; alreadyPaid: boolean; row: BillingPaymentRow }
  | { ok: false; reason: ConfirmFailure }

export interface ConfirmDeps {
  repo: BillingRepo
  config: RazorpayConfig
  fetchPayment?: (config: RazorpayConfig, paymentId: string) => Promise<RazorpayPayment>
  now?: () => Date
}

export async function confirmBillingPayment(
  deps: ConfirmDeps,
  input: { accountId: string; orderId: string; paymentId: string; signature: string },
): Promise<ConfirmResult> {
  const { repo, config } = deps
  const fetchPayment = deps.fetchPayment ?? defaultFetchPayment
  const now = deps.now ?? (() => new Date())

  const signatureOk = verifyCheckoutSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
    secret: config.keySecret,
  })
  if (!signatureOk) return { ok: false, reason: 'bad_signature' }

  const row = await repo.findByOrder(input.accountId, input.orderId)
  if (!row) return { ok: false, reason: 'unknown_order' }

  if (row.status === 'paid') {
    // The same payment confirmed twice is fine. A different payment id
    // against an already paid order is not.
    return row.razorpay_payment_id === input.paymentId
      ? { ok: true, alreadyPaid: true, row }
      : { ok: false, reason: 'payment_mismatch' }
  }

  let payment: RazorpayPayment
  try {
    payment = await fetchPayment(config, input.paymentId)
  } catch (err) {
    if (err instanceof RazorpayError && err.status === 404) {
      return { ok: false, reason: 'payment_mismatch' }
    }
    console.error('[billing] could not read the payment from Razorpay:', err)
    return { ok: false, reason: 'razorpay_unavailable' }
  }

  if (payment.id !== input.paymentId || payment.order_id !== input.orderId) {
    return { ok: false, reason: 'payment_mismatch' }
  }
  if (payment.amount !== row.amount_paise || payment.currency !== row.currency) {
    return { ok: false, reason: 'amount_mismatch' }
  }
  if (payment.status !== 'captured') {
    return { ok: false, reason: 'not_captured' }
  }

  const paidAt = now()
  const accessUntil = computeAccessUntil(await repo.latestAccessUntil(input.accountId), paidAt)
  const settled = await repo.markPaid(row.id, {
    paymentId: input.paymentId,
    paidAt,
    accessUntil,
  })

  if (settled) return { ok: true, alreadyPaid: false, row: settled }

  // Another request settled it first. Report what is stored.
  const latest = await repo.findByOrder(input.accountId, input.orderId)
  if (latest && latest.status === 'paid' && latest.razorpay_payment_id === input.paymentId) {
    return { ok: true, alreadyPaid: true, row: latest }
  }
  return { ok: false, reason: 'payment_mismatch' }
}
