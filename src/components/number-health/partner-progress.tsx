'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PARTNER_GOALS, type PartnerSummary, type QualityRating } from '@/lib/whatsapp/number-health'

/**
 * Tech Partner progress. Rendered only when the API said this viewer is a
 * partner operator (owner + PARTNER_OPERATOR_EMAILS); the partner route
 * enforces the same rule, so hiding it here is presentation only.
 */
export function PartnerProgress({ quality }: { quality: QualityRating }) {
  const t = useTranslations('NumberHealth')
  const [summary, setSummary] = useState<PartnerSummary | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/number-health/partner')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: PartnerSummary) => {
        if (!cancelled) setSummary(body)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{t('partnerTitle')}</h2>
        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
          {t('ownersOnly')}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{t('partnerHint')}</p>

      {failed ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !summary ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="mt-4 space-y-5">
          <Progress
            label={t('goalMessages')}
            value={summary.avgDailyMessages7d}
            goal={PARTNER_GOALS.avgDailyMessages}
          />
          <Progress
            label={t('goalCustomers')}
            value={summary.activeCustomers}
            goal={PARTNER_GOALS.activeCustomers}
          />
          <p className="text-sm text-foreground">
            {quality === 'high' ? t('goalQualityMet') : t('goalQualityNotMet')}
          </p>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('customersTitle')}</h3>
            <p className="text-xs text-muted-foreground">{t('customersHint')}</p>
            {summary.customers.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('customersEmpty')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {summary.customers.map((c) => (
                  <li key={c.account_id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1 font-medium text-foreground">{c.account_name}</span>
                    <span className="text-muted-foreground">
                      {t('messagesCount', { count: c.messages_30d })}
                    </span>
                    <span className="w-28 text-right text-xs text-muted-foreground">
                      {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Progress({ label, value, goal }: { label: string; value: number; goal: number }) {
  const t = useTranslations('NumberHealth')
  const pct = Math.min(100, Math.round((value / goal) * 100))
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {t('progressOf', { value: value.toLocaleString(), goal: goal.toLocaleString() })}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
