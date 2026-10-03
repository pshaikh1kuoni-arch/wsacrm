// ============================================================
// The WAGenie subscription — one plan, paid one month at a time.
// Pure helpers, no I/O. Auto renewal comes later; for now each paid
// receipt adds one calendar month.
// ============================================================

export const PLAN = {
  name: 'WAGenie Standard',
  /** ₹2,500 in paise. Razorpay always works in the smallest unit. */
  amountPaise: 250_000,
  currency: 'INR',
} as const

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Add one calendar month in UTC. A date that does not exist next month
 * lands on that month's last day: 31 Jan becomes 28 Feb (29 in a leap
 * year), never 3 March.
 */
export function addOneMonth(from: Date): Date {
  const year = from.getUTCFullYear()
  const month = from.getUTCMonth()
  const targetYear = month === 11 ? year + 1 : year
  const targetMonth = (month + 1) % 12
  const day = Math.min(from.getUTCDate(), daysInUtcMonth(targetYear, targetMonth))
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  )
}

/**
 * Where access runs to after a payment. Paying early stacks on top of
 * the time still left; paying late starts from the payment time.
 */
export function computeAccessUntil(currentUntil: Date | null, paidAt: Date): Date {
  const base = currentUntil && currentUntil.getTime() > paidAt.getTime() ? currentUntil : paidAt
  return addOneMonth(base)
}

export type SubscriptionState = 'active' | 'expired' | 'not_paid'

export function subscriptionState(paidUntil: Date | null, now: Date): SubscriptionState {
  if (!paidUntil) return 'not_paid'
  return paidUntil.getTime() > now.getTime() ? 'active' : 'expired'
}

/** 250000 paise becomes "₹2,500". Whole rupees only; paise are shown if present. */
export function formatRupees(paise: number): string {
  const rupees = paise / 100
  const hasPaise = paise % 100 !== 0
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}

/** pay_QxAbCdEf8Kd becomes pay_Qx••••8Kd, so a receipt can be shown safely. */
export function maskPaymentId(id: string): string {
  if (id.length <= 9) return id
  return `${id.slice(0, 6)}••••${id.slice(-3)}`
}
