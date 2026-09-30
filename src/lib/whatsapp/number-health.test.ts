import { describe, expect, it } from 'vitest'
import {
  diffHealth,
  isHealthStale,
  isPartnerOperator,
  messagingLimitFromTier,
  normalizeQuality,
  onlyDigits,
  summarizePlatform,
} from './number-health'

describe('normalizeQuality', () => {
  it('maps Meta colours to ratings', () => {
    expect(normalizeQuality('GREEN')).toBe('high')
    expect(normalizeQuality('yellow')).toBe('medium')
    expect(normalizeQuality('RED')).toBe('low')
  })
  it('treats NA, missing and junk as unknown', () => {
    expect(normalizeQuality('NA')).toBe('unknown')
    expect(normalizeQuality(undefined)).toBe('unknown')
    expect(normalizeQuality(42)).toBe('unknown')
  })
})

describe('messagingLimitFromTier', () => {
  it('parses plain, K and M tiers', () => {
    expect(messagingLimitFromTier('TIER_50')).toEqual({ value: 50, unlimited: false })
    expect(messagingLimitFromTier('TIER_1K')).toEqual({ value: 1000, unlimited: false })
    expect(messagingLimitFromTier('TIER_100K')).toEqual({ value: 100000, unlimited: false })
    expect(messagingLimitFromTier('TIER_2M')).toEqual({ value: 2000000, unlimited: false })
  })
  it('flags unlimited', () => {
    expect(messagingLimitFromTier('TIER_UNLIMITED')).toEqual({ value: null, unlimited: true })
  })
  it('returns unknown for anything else', () => {
    expect(messagingLimitFromTier(null)).toEqual({ value: null, unlimited: false })
    expect(messagingLimitFromTier('SOMETHING')).toEqual({ value: null, unlimited: false })
  })
})

describe('diffHealth', () => {
  const base = { quality_rating: 'high' as const, messaging_limit_tier: 'TIER_1K' }
  it('records nothing on the first sync', () => {
    expect(diffHealth(null, base)).toEqual([])
  })
  it('records nothing when nothing changed', () => {
    expect(diffHealth(base, { ...base })).toEqual([])
  })
  it('records a quality change', () => {
    expect(diffHealth(base, { ...base, quality_rating: 'low' })).toEqual([
      { kind: 'quality_change', previous: 'high', next: 'low' },
    ])
  })
  it('records both changes together', () => {
    const changes = diffHealth(base, {
      quality_rating: 'medium',
      messaging_limit_tier: 'TIER_10K',
    })
    expect(changes.map((c) => c.kind)).toEqual(['quality_change', 'limit_change'])
  })
})

describe('isHealthStale', () => {
  const now = Date.parse('2026-09-30T12:00:00Z')
  it('is stale when never synced or unparseable', () => {
    expect(isHealthStale(null, 1000, now)).toBe(true)
    expect(isHealthStale('nope', 1000, now)).toBe(true)
  })
  it('compares age to the limit', () => {
    expect(isHealthStale('2026-09-30T11:59:59Z', 5000, now)).toBe(false)
    expect(isHealthStale('2026-09-30T11:00:00Z', 5000, now)).toBe(true)
  })
})

describe('isPartnerOperator', () => {
  it('matches case-insensitively against a comma list', () => {
    expect(isPartnerOperator('Me@Example.com', ' a@b.co , me@example.com ')).toBe(true)
  })
  it('is false for a missing email or unset list', () => {
    expect(isPartnerOperator(undefined, 'me@example.com')).toBe(false)
    expect(isPartnerOperator('me@example.com', undefined)).toBe(false)
    expect(isPartnerOperator('me@example.com', '')).toBe(false)
  })
  it('does not match a different address', () => {
    expect(isPartnerOperator('other@example.com', 'me@example.com')).toBe(false)
  })
})

describe('summarizePlatform', () => {
  const row = (id: string, m30: number, m7: number) => ({
    account_id: id,
    account_name: id,
    messages_30d: m30,
    messages_7d: m7,
    last_message_at: null,
  })
  it('counts active accounts and averages 7 day volume', () => {
    const s = summarizePlatform([row('a', 100, 70), row('b', 0, 0), row('c', 5, 7)])
    expect(s.activeCustomers).toBe(2)
    expect(s.avgDailyMessages7d).toBe(11)
    expect(s.customers.map((c) => c.account_id)).toEqual(['a', 'c'])
  })
  it('handles no accounts', () => {
    expect(summarizePlatform([])).toEqual({
      avgDailyMessages7d: 0,
      activeCustomers: 0,
      customers: [],
    })
  })
})

describe('onlyDigits', () => {
  it('strips formatting', () => {
    expect(onlyDigits('+91 87794 71874')).toBe('918779471874')
    expect(onlyDigits(undefined)).toBe('')
  })
})
