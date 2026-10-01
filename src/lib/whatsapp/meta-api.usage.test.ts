import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWabaUsage, MetaApiError } from './meta-api'

/**
 * Usage and cost comes from the WABA's `pricing_analytics` field: one GET
 * on the WABA node, with the report's options written inside `fields`.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/pricing_analytics/
 */

let capturedUrl: string | null = null
let capturedInit: RequestInit | null = null
let respond: () => Response

const ARGS = { wabaId: 'waba-1', accessToken: 'tok', start: 1000, end: 2000 } as const

beforeEach(() => {
  capturedUrl = null
  capturedInit = null
  respond = () => new Response(JSON.stringify({}), { status: 200 })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      capturedUrl = url
      capturedInit = init
      return respond()
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getWabaUsage', () => {
  it('asks for cost and volume per category and type, by day', async () => {
    await getWabaUsage(ARGS)
    const url = new URL(String(capturedUrl))
    expect(url.origin + url.pathname).toBe('https://graph.facebook.com/v21.0/waba-1')
    expect(url.searchParams.get('fields')).toBe(
      'currency,pricing_analytics.start(1000).end(2000).granularity(DAILY)' +
        '.metric_types(["COST","VOLUME"]).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])',
    )
    expect(capturedInit?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('returns the currency and flattens the data points', async () => {
    respond = () =>
      new Response(
        JSON.stringify({
          currency: 'INR',
          pricing_analytics: {
            data: [
              {
                data_points: [
                  { pricing_category: 'UTILITY', volume: 2, cost: 0.23 },
                  { pricing_category: 'SERVICE', volume: 5, cost: 0 },
                ],
              },
              { data_points: [{ pricing_category: 'MARKETING', volume: 1, cost: 0.86 }] },
            ],
          },
          id: 'waba-1',
        }),
        { status: 200 },
      )
    const usage = await getWabaUsage(ARGS)
    expect(usage.currency).toBe('INR')
    expect(usage.dataPoints).toHaveLength(3)
  })

  it('returns no points and no currency when Meta sends neither', async () => {
    const usage = await getWabaUsage(ARGS)
    expect(usage).toEqual({ currency: null, dataPoints: [] })
  })

  it('throws a MetaApiError with Meta\'s message on failure', async () => {
    respond = () =>
      new Response(
        JSON.stringify({
          error: { message: '(#200) Permission denied', code: 200, fbtrace_id: 'abc' },
        }),
        { status: 403 },
      )
    await expect(getWabaUsage(ARGS)).rejects.toMatchObject({
      name: 'MetaApiError',
      message: '(#200) Permission denied',
      code: 200,
      httpStatus: 403,
    })
    await expect(getWabaUsage(ARGS)).rejects.toBeInstanceOf(MetaApiError)
  })
})
