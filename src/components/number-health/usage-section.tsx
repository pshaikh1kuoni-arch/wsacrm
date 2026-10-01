'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatMoney, type UsageSummary } from '@/lib/whatsapp/usage'
import { EmptyCard, Tile } from './cards'

type Payload =
  | { status: 'ok'; usage: UsageSummary }
  | { status: 'no_waba' | 'not_connected' | 'unavailable' }

/**
 * What the account's WhatsApp messages cost over the last 30 days. Loads
 * on its own so a Meta failure never takes the rest of the page down.
 * The parent changes `key` to make it read again.
 */
export function UsageSection() {
  const t = useTranslations('NumberHealth')
  const [data, setData] = useState<Payload | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/number-health/usage')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<Payload>
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch(() => {
        if (!cancelled) setData({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (data?.status === 'not_connected') return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('usageTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('usageHint')}</p>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : data.status === 'no_waba' ? (
        <EmptyCard
          title={t('usageNoWabaTitle')}
          body={t('usageNoWabaBody')}
          href="/settings"
          cta={t('goToSettings')}
        />
      ) : data.status === 'ok' ? (
        <UsageDetails usage={data.usage} />
      ) : (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {t('usageUnavailable')}
        </p>
      )}
    </section>
  )
}

function UsageDetails({ usage }: { usage: UsageSummary }) {
  const t = useTranslations('NumberHealth')
  const money = (amount: number) => formatMoney(amount, usage.currency)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label={t('usageSpent')} hint={t('usageSpentHint')}>
          <span className="text-3xl font-bold text-foreground">{money(usage.totalCost)}</span>
        </Tile>
        <Tile label={t('usageTemplates')} hint={t('usageTemplatesHint')}>
          <span className="text-3xl font-bold text-foreground">
            {usage.templatesSent.toLocaleString()}
          </span>
        </Tile>
        <Tile label={t('usageService')} hint={t('usageServiceHint')}>
          <span className="text-3xl font-bold text-foreground">
            {usage.freeService.toLocaleString()}
          </span>
        </Tile>
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h3 className="text-lg font-semibold text-foreground">{t('usageByTypeTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('usageByTypeHint')}</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium text-muted-foreground">
              <th scope="col" className="py-2 text-left font-medium">
                {t('usageColType')}
              </th>
              <th scope="col" className="w-28 py-2 text-right font-medium">
                {t('usageColMessages')}
              </th>
              <th scope="col" className="w-28 py-2 text-right font-medium">
                {t('usageColCost')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usage.byType.map((row) => (
              <tr key={row.type}>
                <td className="py-2.5">
                  <span className="block font-medium text-foreground">
                    {t(`usageType_${row.type}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`usageTypeHint_${row.type}`)}
                  </span>
                </td>
                <td className="py-2.5 text-right text-foreground">
                  {row.messages.toLocaleString()}
                </td>
                <td className="py-2.5 text-right text-foreground">
                  {row.type === 'service' ? (
                    <span className="text-muted-foreground">{t('usageFree')}</span>
                  ) : (
                    money(row.cost)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold text-foreground">
              <td className="pt-3">{t('usageTotal')}</td>
              <td className="pt-3 text-right">{usage.templatesSent.toLocaleString()}</td>
              <td className="pt-3 text-right">{money(usage.totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}
