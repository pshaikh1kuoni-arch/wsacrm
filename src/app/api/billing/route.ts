// ============================================================
// GET /api/billing — the subscription status and payment history.
//
// Admin and Owner can read it. Only the Owner can pay (the order and
// verify routes beside this file). The page reads `canPay` from here
// so the button state matches what the server will accept.
//
// If migration 055 has not been applied yet, this answers with
// `database: 'migration_missing'` instead of an error, so the Billing
// screen can say so plainly.
// ============================================================

import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { canManageBilling } from '@/lib/auth/roles'
import { supabaseAdmin } from '@/lib/billing/admin-client'
import { maskPaymentId, PLAN, subscriptionState } from '@/lib/billing/plan'
import { BillingNotReadyError, createBillingRepo } from '@/lib/billing/repo'
import { getRazorpayConfig } from '@/lib/razorpay/client'

export async function GET() {
  try {
    const ctx = await requireRole('admin')
    const config = getRazorpayConfig()

    const base = {
      plan: { name: PLAN.name, amountPaise: PLAN.amountPaise, currency: PLAN.currency },
      razorpay: { configured: config !== null, testMode: config?.testMode ?? false },
      canPay: canManageBilling(ctx.role),
    }

    try {
      const repo = createBillingRepo(supabaseAdmin())
      const [rows, paidUntil] = await Promise.all([
        repo.listPayments(ctx.accountId),
        repo.latestAccessUntil(ctx.accountId),
      ])

      return NextResponse.json({
        ...base,
        database: 'ready',
        paidUntil: paidUntil ? paidUntil.toISOString() : null,
        state: subscriptionState(paidUntil, new Date()),
        payments: rows.map((r) => ({
          id: r.id,
          receipt: r.receipt,
          amountPaise: r.amount_paise,
          currency: r.currency,
          status: r.status,
          paymentRef: r.razorpay_payment_id ? maskPaymentId(r.razorpay_payment_id) : null,
          createdAt: r.created_at,
          paidAt: r.paid_at,
        })),
      })
    } catch (err) {
      if (err instanceof BillingNotReadyError) {
        return NextResponse.json({
          ...base,
          database: 'migration_missing',
          paidUntil: null,
          state: 'not_paid',
          payments: [],
        })
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
