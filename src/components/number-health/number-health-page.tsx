'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft, HeartPulse, RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { canEditSettings } from '@/lib/auth/roles'
import {
  messagingLimitFromTier,
  type QualityRating,
} from '@/lib/whatsapp/number-health'
import { DailyVolumeChart, type DailyRow } from './daily-volume-chart'
import { PartnerProgress } from './partner-progress'
import { QualityBadge } from './quality-badge'

interface HealthRow {
  phone_number_id: string
  display_phone_number: string | null
  verified_name: string | null
  quality_rating: QualityRating
  messaging_limit_tier: string | null
  name_status: string | null
  synced_at: string
}

interface EventRow {
  id: string
  kind: 'quality_change' | 'limit_change' | 'meta_event'
  previous_value: string | null
  new_value: string | null
  meta_event: string | null
  created_at: string
}

interface Payload {
  connected: boolean
  health: HealthRow | null
  events: EventRow[]
  daily: DailyRow[]
  syncError: string | null
  canViewPartner: boolean
}

export function NumberHealthPage() {
  const t = useTranslations('NumberHealth')
  const { accountRole } = useAuth()
  const canRefresh = accountRole ? canEditSettings(accountRole) : false

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const res = await fetch(`/api/number-health?tz=${encodeURIComponent(tz)}`)
      if (!res.ok) throw new Error(String(res.status))
      setData((await res.json()) as Payload)
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function refresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const res = await fetch('/api/number-health/refresh', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setRefreshError(body?.error ?? t('refreshFailed'))
      } else {
        await load()
      }
    } catch {
      setRefreshError(t('refreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const health = data?.health ?? null
  const limit = messagingLimitFromTier(health?.messaging_limit_tier)
  const todayRow = data?.daily.at(-1)
  const todayKey = new Date().toLocaleDateString('en-CA')
  const messagesToday =
    todayRow && todayRow.day === todayKey
      ? Number(todayRow.inbound) + Number(todayRow.outbound)
      : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          {health && (
            <span className="text-sm text-muted-foreground">
              {t('lastUpdate', { time: new Date(health.synced_at).toLocaleString() })}
            </span>
          )}
          {canRefresh && data?.connected && (
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          )}
        </div>
      </div>

      {refreshError && (
        <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {refreshError}
        </p>
      )}
      {data?.syncError && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {t('syncError')}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : failed || !data ? (
        <p className="text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !data.connected ? (
        <EmptyCard
          title={t('notConnectedTitle')}
          body={t('notConnectedBody')}
          href="/settings"
          cta={t('goToSettings')}
        />
      ) : (
        <>
          {health?.quality_rating === 'low' && (
            <div role="alert" className="rounded-2xl bg-red-500/10 p-5">
              <p className="font-semibold text-red-700 dark:text-red-400">{t('lowAlertTitle')}</p>
              <p className="mt-1 text-sm text-red-700/90 dark:text-red-300">{t('lowAlertBody')}</p>
            </div>
          )}

          {!health ? (
            <EmptyCard title={t('waitingTitle')} body={t('waitingBody')} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Tile label={t('quality')} hint={t('qualityHint')}>
                <QualityBadge rating={health.quality_rating} large />
              </Tile>
              <Tile label={t('limit')} hint={t('limitHint')}>
                <span className="text-3xl font-bold text-foreground">
                  {limit.unlimited
                    ? t('unlimited')
                    : limit.value !== null
                      ? limit.value.toLocaleString()
                      : t('unknown')}
                </span>
              </Tile>
              <Tile label={t('messagesToday')} hint={t('messagesTodayHint')}>
                <span className="text-3xl font-bold text-foreground">
                  {messagesToday.toLocaleString()}
                </span>
              </Tile>
            </div>
          )}

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t('chartTitle')}</h2>
            <DailyVolumeChart rows={data.daily} />
          </section>

          {data.canViewPartner && <PartnerProgress quality={health?.quality_rating ?? 'unknown'} />}

          <section className="rounded-2xl bg-card p-5 shadow-card">
            <h2 className="text-lg font-semibold text-foreground">{t('historyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('historyHint')}</p>
            {data.events.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t('historyEmpty')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.events.map((e) => (
                  <li key={e.id} className="flex gap-4 py-2.5 text-sm">
                    <span className="w-28 shrink-0 text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-foreground">{describeEvent(e, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function describeEvent(
  e: EventRow,
  t: ReturnType<typeof useTranslations>,
): string {
  if (e.kind === 'quality_change') {
    return t('eventQuality', {
      from: t(`rating_${e.previous_value ?? 'unknown'}`),
      to: t(`rating_${e.new_value ?? 'unknown'}`),
    })
  }
  if (e.kind === 'limit_change') {
    const from = messagingLimitFromTier(e.previous_value)
    const to = messagingLimitFromTier(e.new_value)
    const fmt = (l: typeof from) =>
      l.unlimited ? t('unlimited') : l.value !== null ? l.value.toLocaleString() : t('unknown')
    return t('eventLimit', { from: fmt(from), to: fmt(to) })
  }
  return t('eventMeta', { event: e.meta_event ?? t('unknown') })
}

function Tile({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-card">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

function EmptyCard({
  title,
  body,
  href,
  cta,
}: {
  title: string
  body: string
  href?: string
  cta?: string
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-xl text-sm text-muted-foreground">{body}</p>
      {href && cta && (
        <Link href={href} className={buttonVariants()}>
          {cta}
        </Link>
      )}
    </div>
  )
}
