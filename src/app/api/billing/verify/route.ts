// ============================================================
// POST /api/billing/verify — settle a payment after Checkout closes.
//
// Owner only. The browser sends the three values Razorpay Checkout
// gave it. The server does not believe them: it checks the signature,
// then asks Razorpay for the payment and compares order, amount and
// status (see src/lib/billing/confirm.ts). Only then is the receipt
// marked paid and a month added.
// ============================================================

import { NextResponse } from 'next/server'

import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/billing/admin-client'
import { confirmBillingPayment, type ConfirmFailure } from '@/lib/billing/confirm'
import { BillingNotReadyError, createBillingRepo } from '@/lib/billing/repo'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { getRazorpayConfig } from '@/lib/razorpay/client'

const FAILURES: Record<ConfirmFailure, { status: number; error: string }> = {
  bad_signature: { status: 400, error: 'The payment could not be verified.' },
  unknown_order: { status: 404, error: 'We do not know this payment.' },
  payment_mismatch: { status: 409, error: 'This payment does not match the order.' },
  amount_mismatch: { status: 409, error: 'The amount paid does not match the plan.' },
  not_captured: { status: 409, error: 'Razorpay has not confirmed the payment yet.' },
  razorpay_unavailable: { status: 502, error: 'Could not reach Razorpay. Please try again.' },
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner')

    const limit = checkRateLimit(`billing:verify:${ctx.userId}`, RATE_LIMITS.billing)
    if (!limit.success) return rateLimitResponse(limit)

    const config = getRazorpayConfig()
    if (!config) {
      return NextResponse.json(
        { error: 'Payments are not switched on for this server yet.', code: 'not_configured' },
        { status: 503 },
      )
    }

    const body = (await request.json().catch(() => null)) as {
      razorpay_order_id?: unknown
      razorpay_payment_id?: unknown
      razorpay_signature?: unknown
    } | null

    const orderId = body?.razorpay_order_id
    const paymentId = body?.razorpay_payment_id
    const signature = body?.razorpay_signature
    if (
      typeof orderId !== 'string' ||
      typeof paymentId !== 'string' ||
      typeof signature !== 'string' ||
      !orderId ||
      !paymentId ||
      !signature
    ) {
      return NextResponse.json({ error: 'Missing payment details.' }, { status: 400 })
    }

    try {
      const result = await confirmBillingPayment(
        { repo: createBillingRepo(supabaseAdmin()), config },
        { accountId: ctx.accountId, orderId, paymentId, signature },
      )

      if (!result.ok) {
        const failure = FAILURES[result.reason]
        return NextResponse.json({ error: failure.error, code: result.reason }, { status: failure.status })
      }

      return NextResponse.json({
        status: 'paid',
        alreadyPaid: result.alreadyPaid,
        receipt: result.row.receipt,
        accessUntil: result.row.access_until,
      })
    } catch (err) {
      if (err instanceof BillingNotReadyError) {
        return NextResponse.json(
          { error: 'Billing is not set up in the database yet.', code: 'migration_missing' },
          { status: 503 },
        )
      }
      throw err
    }
  } catch (err) {
    return toErrorResponse(err)
  }
}
