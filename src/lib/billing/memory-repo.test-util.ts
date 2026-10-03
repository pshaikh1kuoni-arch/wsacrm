// In-memory BillingRepo for tests. Mirrors the rules the real one gets
// from the database: unique receipts, settle-once, newest first.
import type { BillingPaymentRow, BillingRepo } from './repo'

export function createMemoryRepo(seed: BillingPaymentRow[] = []): BillingRepo & {
  rows: BillingPaymentRow[]
} {
  const rows = [...seed]
  let counter = rows.length

  return {
    rows,

    async listPayments(accountId, limit = 20) {
      return rows
        .filter((r) => r.account_id === accountId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
    },

    async findByOrder(accountId, razorpayOrderId) {
      return (
        rows.find((r) => r.account_id === accountId && r.razorpay_order_id === razorpayOrderId) ??
        null
      )
    },

    async latestAccessUntil(accountId) {
      const dates = rows
        .filter((r) => r.account_id === accountId && r.status === 'paid' && r.access_until)
        .map((r) => new Date(r.access_until as string).getTime())
      return dates.length ? new Date(Math.max(...dates)) : null
    },

    async insertCreated({ accountId, amountPaise, currency }) {
      counter += 1
      const row: BillingPaymentRow = {
        id: `id-${counter}`,
        account_id: accountId,
        receipt: `WAG-${String(counter).padStart(6, '0')}`,
        razorpay_order_id: null,
        razorpay_payment_id: null,
        amount_paise: amountPaise,
        currency,
        status: 'created',
        access_until: null,
        created_at: new Date(2026, 9, 3, 10, 0, counter).toISOString(),
        paid_at: null,
      }
      rows.push(row)
      return { ...row }
    },

    async attachOrder(id, razorpayOrderId) {
      const row = rows.find((r) => r.id === id)
      if (row) row.razorpay_order_id = razorpayOrderId
    },

    async markFailed(id) {
      const row = rows.find((r) => r.id === id)
      if (row && row.status === 'created') row.status = 'failed'
    },

    async markPaid(id, { paymentId, paidAt, accessUntil }) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.status === 'paid') return null
      row.status = 'paid'
      row.razorpay_payment_id = paymentId
      row.paid_at = paidAt.toISOString()
      row.access_until = accessUntil.toISOString()
      return { ...row }
    },
  }
}
