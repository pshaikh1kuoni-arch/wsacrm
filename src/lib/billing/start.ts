// ============================================================
// Starting a subscription payment: record the attempt, then ask
// Razorpay for an order with the receipt number we just got.
// ============================================================

import {
  createOrder as defaultCreateOrder,
  type RazorpayConfig,
  type RazorpayOrder,
} from '@/lib/razorpay/client'

import { PLAN } from './plan'
import type { BillingPaymentRow, BillingRepo } from './repo'

export interface StartDeps {
  repo: BillingRepo
  config: RazorpayConfig
  createOrder?: typeof defaultCreateOrder
}

export async function startBillingPayment(
  deps: StartDeps,
  input: { accountId: string; userId: string },
): Promise<{ row: BillingPaymentRow; order: RazorpayOrder }> {
  const { repo, config } = deps
  const createOrder = deps.createOrder ?? defaultCreateOrder

  const row = await repo.insertCreated({
    accountId: input.accountId,
    userId: input.userId,
    amountPaise: PLAN.amountPaise,
    currency: PLAN.currency,
  })

  try {
    const order = await createOrder(config, {
      amountPaise: PLAN.amountPaise,
      currency: PLAN.currency,
      receipt: row.receipt,
      notes: { purpose: 'wagenie_subscription', account_id: input.accountId },
    })
    await repo.attachOrder(row.id, order.id)
    return { row: { ...row, razorpay_order_id: order.id }, order }
  } catch (err) {
    // Do not leave a dangling "created" row that can never be paid.
    await repo.markFailed(row.id).catch(() => undefined)
    throw err
  }
}
