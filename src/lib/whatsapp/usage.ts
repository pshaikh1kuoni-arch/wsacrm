/**
 * Pure helpers for the Usage and cost section of the Number health page.
 * No I/O — everything here is unit-tested in usage.test.ts.
 */

/** One row of Meta's `pricing_analytics` report. Every field may be missing. */
export interface UsageDataPoint {
  pricing_category?: string
  pricing_type?: string
  volume?: number | string
  cost?: number | string
}

export type UsageTypeKey =
  | 'marketing'
  | 'utility'
  | 'authentication'
  | 'service'
  | 'other'

export interface UsageRow {
  type: UsageTypeKey
  messages: number
  cost: number
}

export interface UsageSummary {
  /** The WhatsApp Business Account's billing currency, e.g. INR. */
  currency: string | null
  totalCost: number
  /** Marketing, utility and authentication messages (some may be free). */
  templatesSent: number
  /** Service messages: replies inside the 24 hour window. */
  freeService: number
  byType: UsageRow[]
}

const WINDOW_DAYS = 30
const DAY_SECONDS = 24 * 60 * 60

/** The report covers the last 30 days up to now, as unix seconds. */
export function usageWindow(now: number = Date.now()): { start: number; end: number } {
  const end = Math.floor(now / 1000)
  return { start: end - WINDOW_DAYS * DAY_SECONDS, end }
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(n) ? n : 0
}

// Float sums pick up noise like 0.30000000000000004.
function round(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function typeOf(category: unknown): UsageTypeKey {
  switch (typeof category === 'string' ? category.toUpperCase() : '') {
    case 'MARKETING':
      return 'marketing'
    case 'UTILITY':
      return 'utility'
    case 'AUTHENTICATION':
      return 'authentication'
    case 'SERVICE':
      return 'service'
    default:
      return 'other'
  }
}

/**
 * Add up Meta's data points by message type. The four known types always
 * appear; "other" only when something landed in it.
 */
export function summarizeUsage(
  points: UsageDataPoint[],
  currency: string | null,
): UsageSummary {
  const rows: Record<UsageTypeKey, UsageRow> = {
    marketing: { type: 'marketing', messages: 0, cost: 0 },
    utility: { type: 'utility', messages: 0, cost: 0 },
    authentication: { type: 'authentication', messages: 0, cost: 0 },
    service: { type: 'service', messages: 0, cost: 0 },
    other: { type: 'other', messages: 0, cost: 0 },
  }

  for (const point of points) {
    const row = rows[typeOf(point?.pricing_category)]
    row.messages += toNumber(point?.volume)
    row.cost += toNumber(point?.cost)
  }

  const byType = (Object.keys(rows) as UsageTypeKey[])
    .map((key) => ({ ...rows[key], cost: round(rows[key].cost) }))
    .filter((row) => row.type !== 'other' || row.messages > 0 || row.cost > 0)

  return {
    currency,
    totalCost: round(byType.reduce((sum, row) => sum + row.cost, 0)),
    templatesSent: byType
      .filter((row) => row.type !== 'service')
      .reduce((sum, row) => sum + row.messages, 0),
    freeService: rows.service.messages,
    byType,
  }
}

/** `10` + `INR` → `₹10.00`. Falls back to a plain number on a bad currency code. */
export function formatMoney(
  amount: number,
  currency: string | null,
  locale?: string,
): string {
  if (!currency) return amount.toFixed(2)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}
