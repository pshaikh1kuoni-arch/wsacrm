import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('./number-health-sync', () => ({ refreshNumberHealth: h.refresh }))

import {
  handleNumberHealthWebhookChange,
  isNumberHealthWebhookField,
} from './number-health-webhook'

interface Stub {
  client: SupabaseClient
  inserts: Record<string, unknown>[]
}

function makeSupabase(opts: {
  configs: { account_id: string; phone_number_id: string; access_token: string }[]
  known?: { account_id: string; display_phone_number: string | null }[]
}): Stub {
  const inserts: Record<string, unknown>[] = []
  const client = {
    from(table: string) {
      if (table === 'whatsapp_config') {
        return { select: () => ({ eq: async () => ({ data: opts.configs, error: null }) }) }
      }
      if (table === 'number_health') {
        return { select: () => ({ in: async () => ({ data: opts.known ?? [], error: null }) }) }
      }
      if (table === 'number_health_events') {
        return {
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row)
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
  return { client, inserts }
}

const cfg = (account: string, phone = 'p1') => ({
  account_id: account,
  phone_number_id: phone,
  access_token: 'enc',
})

beforeEach(() => {
  h.refresh.mockReset()
  h.refresh.mockResolvedValue({})
})

describe('isNumberHealthWebhookField', () => {
  it('recognises the two fields', () => {
    expect(isNumberHealthWebhookField('phone_number_quality_update')).toBe(true)
    expect(isNumberHealthWebhookField('account_update')).toBe(true)
    expect(isNumberHealthWebhookField('messages')).toBe(false)
  })
})

describe('handleNumberHealthWebhookChange', () => {
  it('refreshes the account that owns the WABA and passes Meta event through', async () => {
    const { client } = makeSupabase({ configs: [cfg('acc-1')] })
    await handleNumberHealthWebhookChange(
      {
        field: 'phone_number_quality_update',
        wabaId: 'waba-1',
        value: { event: 'DOWNGRADE', display_phone_number: '918779471874', current_limit: 'TIER_250' },
      },
      client,
    )
    expect(h.refresh).toHaveBeenCalledTimes(1)
    const args = h.refresh.mock.calls[0][1]
    expect(args).toMatchObject({
      accountId: 'acc-1',
      phoneNumberId: 'p1',
      source: 'webhook',
      metaEvent: 'DOWNGRADE',
    })
  })

  it('ignores an event with no WABA id', async () => {
    const { client } = makeSupabase({ configs: [cfg('acc-1')] })
    await handleNumberHealthWebhookChange(
      { field: 'account_update', value: { event: 'VERIFIED_ACCOUNT' } },
      client,
    )
    expect(h.refresh).not.toHaveBeenCalled()
  })

  it('ignores a WABA no account uses', async () => {
    const { client } = makeSupabase({ configs: [] })
    await handleNumberHealthWebhookChange(
      { field: 'account_update', wabaId: 'nobody', value: { event: 'X' } },
      client,
    )
    expect(h.refresh).not.toHaveBeenCalled()
  })

  it('attributes by phone number when accounts share a WABA', async () => {
    const { client } = makeSupabase({
      configs: [cfg('acc-1', 'p1'), cfg('acc-2', 'p2')],
      known: [
        { account_id: 'acc-1', display_phone_number: '+91 11111 11111' },
        { account_id: 'acc-2', display_phone_number: '+91 22222 22222' },
      ],
    })
    await handleNumberHealthWebhookChange(
      {
        field: 'phone_number_quality_update',
        wabaId: 'shared',
        value: { event: 'UPGRADE', display_phone_number: '912222222222' },
      },
      client,
    )
    expect(h.refresh).toHaveBeenCalledTimes(1)
    expect(h.refresh.mock.calls[0][1].accountId).toBe('acc-2')
  })

  it('skips when a shared WABA has no matching number', async () => {
    const { client } = makeSupabase({
      configs: [cfg('acc-1'), cfg('acc-2')],
      known: [],
    })
    await handleNumberHealthWebhookChange(
      {
        field: 'phone_number_quality_update',
        wabaId: 'shared',
        value: { event: 'UPGRADE', display_phone_number: '919000000000' },
      },
      client,
    )
    expect(h.refresh).not.toHaveBeenCalled()
  })

  it('still records the event when the Meta refresh fails', async () => {
    h.refresh.mockRejectedValue(new Error('graph down'))
    const { client, inserts } = makeSupabase({ configs: [cfg('acc-1')] })
    await handleNumberHealthWebhookChange(
      {
        field: 'phone_number_quality_update',
        wabaId: 'waba-1',
        value: { event: 'FLAGGED', current_limit: 'TIER_1K' },
      },
      client,
    )
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({
      account_id: 'acc-1',
      kind: 'meta_event',
      meta_event: 'FLAGGED',
      source: 'webhook',
    })
  })
})
