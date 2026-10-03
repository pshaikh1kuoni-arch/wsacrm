// ============================================================
// billing_payments access — the only place that knows the table.
//
// The routes pass a service-role client (user sessions cannot write
// this table; see migration 055). Everything the confirm step needs is
// behind the BillingRepo interface so it can be tested without a
// database.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

export type BillingStatus = 'created' | 'paid' | 'failed'

export interface BillingPaymentRow {
  id: string
  account_id: string
  receipt: string
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  amount_paise: number
  currency: string
  status: BillingStatus
  access_until: string | null
  created_at: string
  paid_at: string | null
}

/** Thrown when migration 055 has not been applied yet. */
export class BillingNotReadyError extends Error {
  constructor() {
    super('Billing tables are not set up yet (migration 055).')
    this.name = 'BillingNotReadyError'
  }
}

export interface BillingRepo {
  listPayments(accountId: string, limit?: number): Promise<BillingPaymentRow[]>
  findByOrder(accountId: string, razorpayOrderId: string): Promise<BillingPaymentRow | null>
  latestAccessUntil(accountId: string): Promise<Date | null>
  insertCreated(args: {
    accountId: string
    userId: string
    amountPaise: number
    currency: string
  }): Promise<BillingPaymentRow>
  attachOrder(id: string, razorpayOrderId: string): Promise<void>
  markFailed(id: string): Promise<void>
  /** Settle a row as paid. Returns null if it was already paid. */
  markPaid(
    id: string,
    args: { paymentId: string; paidAt: Date; accessUntil: Date },
  ): Promise<BillingPaymentRow | null>
}

const COLUMNS =
  'id, account_id, receipt, razorpay_order_id, razorpay_payment_id, amount_paise, currency, status, access_until, created_at, paid_at'

// 42P01: Postgres "relation does not exist". PGRST205: PostgREST schema
// cache does not know the table. Either means the migration is missing.
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function fail(error: { code?: string; message?: string }): never {
  if (isMissingTable(error)) throw new BillingNotReadyError()
  throw new Error(error.message || 'Billing database error')
}

export function createBillingRepo(db: SupabaseClient): BillingRepo {
  return {
    async listPayments(accountId, limit = 20) {
      const { data, error } = await db
        .from('billing_payments')
        .select(COLUMNS)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) fail(error)
      return (data ?? []) as BillingPaymentRow[]
    },

    async findByOrder(accountId, razorpayOrderId) {
      const { data, error } = await db
        .from('billing_payments')
        .select(COLUMNS)
        .eq('account_id', accountId)
        .eq('razorpay_order_id', razorpayOrderId)
        .maybeSingle()
      if (error) fail(error)
      return (data as BillingPaymentRow | null) ?? null
    },

    async latestAccessUntil(accountId) {
      const { data, error } = await db
        .from('billing_payments')
        .select('access_until')
        .eq('account_id', accountId)
        .eq('status', 'paid')
        .not('access_until', 'is', null)
        .order('access_until', { ascending: false })
        .limit(1)
      if (error) fail(error)
      const value = data?.[0]?.access_until as string | undefined
      return value ? new Date(value) : null
    },

    async insertCreated({ accountId, userId, amountPaise, currency }) {
      const { data, error } = await db
        .from('billing_payments')
        .insert({
          account_id: accountId,
          created_by_user_id: userId,
          amount_paise: amountPaise,
          currency,
        })
        .select(COLUMNS)
        .single()
      if (error) fail(error)
      return data as BillingPaymentRow
    },

    async attachOrder(id, razorpayOrderId) {
      const { error } = await db
        .from('billing_payments')
        .update({ razorpay_order_id: razorpayOrderId })
        .eq('id', id)
      if (error) fail(error)
    },

    async markFailed(id) {
      const { error } = await db
        .from('billing_payments')
        .update({ status: 'failed' })
        .eq('id', id)
        .eq('status', 'created')
      if (error) fail(error)
    },

    async markPaid(id, { paymentId, paidAt, accessUntil }) {
      // `.neq('status', 'paid')` makes this idempotent: of two requests
      // racing to settle the same row, only one gets a row back.
      const { data, error } = await db
        .from('billing_payments')
        .update({
          status: 'paid',
          razorpay_payment_id: paymentId,
          paid_at: paidAt.toISOString(),
          access_until: accessUntil.toISOString(),
        })
        .eq('id', id)
        .neq('status', 'paid')
        .select(COLUMNS)
      if (error) fail(error)
      return ((data ?? [])[0] as BillingPaymentRow | undefined) ?? null
    },
  }
}
