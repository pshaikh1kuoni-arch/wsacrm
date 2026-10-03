// ============================================================
// POST /api/billing/order — start paying the subscription.
//
// Owner only. Records the attempt, asks Razorpay for an order, and
// returns what Razorpay Checkout needs to open in the browser. The
// amount is fixed on the server (PLAN) — the browser sends nothing
// about money, so it cannot ask for a smaller price.
// ============================================================

import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/billing/admin-client'
import { PLAN } from '@/lib/billing/plan'
import { BillingNotReadyError, createBillingRepo } from '@/lib/billing/repo'
import { startBillingPayment } from '@/lib/billing/start'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { getRazorpayConfig, RazorpayError } from '@/lib/razorpay/client'

export async function POST() {
  try {
    const ctx = await requireRole('owner')

    const limit = checkRateLimit(`billing:order:${ctx.userId}`, RATE_LIMITS.billing)
    if (!limit.success) return rateLimitResponse(limit)

    const config = getRazorpayConfig()
    if (!config) {
      return NextResponse.json(
        { error: 'Payments are not switched on for this server yet.', code: 'not_configured' },
        { status: 503 },
      )
    }

    try {
      const { row, order } = await startBillingPayment(
        { repo: createBillingRepo(supabaseAdmin()), config },
        { accountId: ctx.accountId, userId: ctx.userId },
      )

      return NextResponse.json({
        keyId: config.keyId,
        testMode: config.testMode,
        orderId: order.id,
        amountPaise: order.amount,
        currency: order.currency,
        receipt: row.receipt,
        name: 'WAGenie',
        description: `${PLAN.name}, one month`,
      })
    } catch (err) {
      if (err instanceof BillingNotReadyError) {
        return NextResponse.json(
          { error: 'Billing is not set up in the database yet.', code: 'migration_missing' },
          { status: 503 },
        )
      }
      if (err instanceof RazorpayError) {
        console.error('[billing] Razorpay refused the order:', err.status, err.code)
        return NextResponse.json(
          { error: 'Razorpay could not start the payment. Please try again.', code: 'razorpay_error' },
          { status: 502 },
        )
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
