/**
 * Pure helpers for the Number health page and its webhook handler.
 * No I/O — everything here is unit-tested in number-health.test.ts.
 */

export type QualityRating = 'high' | 'medium' | 'low' | 'unknown'

/** Meta reports GREEN / YELLOW / RED (or NA / UNKNOWN before a rating exists). */
export function normalizeQuality(raw: unknown): QualityRating {
  switch (typeof raw === 'string' ? raw.toUpperCase() : '') {
    case 'GREEN':
    case 'HIGH':
      return 'high'
    case 'YELLOW':
    case 'MEDIUM':
      return 'medium'
    case 'RED':
    case 'LOW':
      return 'low'
    default:
      return 'unknown'
  }
}

export interface MessagingLimit {
  /** People the number may start a chat with per 24 hours; null when unknown. */
  value: number | null
  unlimited: boolean
}

/** `TIER_1K` → 1000, `TIER_100K` → 100000, `TIER_UNLIMITED` → unlimited. */
export function messagingLimitFromTier(tier: unknown): MessagingLimit {
  if (typeof tier !== 'string') return { value: null, unlimited: false }
  const upper = tier.toUpperCase()
  if (upper === 'TIER_UNLIMITED') return { value: null, unlimited: true }
  const match = /^TIER_(\d+)(K|M)?$/.exec(upper)
  if (!match) return { value: null, unlimited: false }
  const base = Number(match[1])
  const multiplier = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : 1
  return { value: base * multiplier, unlimited: false }
}

export interface HealthSnapshot {
  quality_rating: QualityRating
  messaging_limit_tier: string | null
}

export interface HealthChange {
  kind: 'quality_change' | 'limit_change'
  previous: string | null
  next: string | null
}

/**
 * What changed between two snapshots. The first sync (`previous` null)
 * is a baseline, not a change, so it records nothing.
 */
export function diffHealth(
  previous: HealthSnapshot | null,
  next: HealthSnapshot,
): HealthChange[] {
  if (!previous) return []
  const changes: HealthChange[] = []
  if (previous.quality_rating !== next.quality_rating) {
    changes.push({
      kind: 'quality_change',
      previous: previous.quality_rating,
      next: next.quality_rating,
    })
  }
  if (previous.messaging_limit_tier !== next.messaging_limit_tier) {
    changes.push({
      kind: 'limit_change',
      previous: previous.messaging_limit_tier,
      next: next.messaging_limit_tier,
    })
  }
  return changes
}

export function onlyDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

/** True when the health snapshot is missing or older than `maxAgeMs`. */
export function isHealthStale(
  syncedAt: string | null | undefined,
  maxAgeMs: number,
  now: number = Date.now(),
): boolean {
  if (!syncedAt) return true
  const t = Date.parse(syncedAt)
  return Number.isNaN(t) || now - t > maxAgeMs
}

/** PARTNER_OPERATOR_EMAILS is a comma-separated list; matching ignores case. */
export function isPartnerOperator(
  email: string | null | undefined,
  envValue: string | undefined,
): boolean {
  if (!email || !envValue) return false
  const wanted = email.trim().toLowerCase()
  return envValue
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted)
}

/** Tech Partner thresholds from Meta's program (confirm with Meta). */
export const PARTNER_GOALS = {
  avgDailyMessages: 2_500,
  activeCustomers: 10,
} as const

export interface PlatformRow {
  account_id: string
  account_name: string
  messages_30d: number
  messages_7d: number
  last_message_at: string | null
}

export interface PartnerSummary {
  avgDailyMessages7d: number
  activeCustomers: number
  customers: PlatformRow[]
}

/** Active customer = connected account with at least 1 message in 30 days. */
export function summarizePlatform(rows: PlatformRow[]): PartnerSummary {
  const customers = rows.filter((r) => r.messages_30d > 0)
  const total7d = rows.reduce((sum, r) => sum + r.messages_7d, 0)
  return {
    avgDailyMessages7d: Math.round(total7d / 7),
    activeCustomers: customers.length,
    customers,
  }
}
