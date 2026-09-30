"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap, HeartPulse } from 'lucide-react'
import type { ComponentType } from 'react'

import { useTranslations } from 'next-intl'
import type { QualityRating } from '@/lib/whatsapp/number-health'

// Quick-action shortcuts. Each navigates to the page that owns the
// relevant "create" flow. We deliberately don't try to auto-open any
// modal on the target page — that'd require touching those pages,
// which is out of scope here.
interface Action {
  labelKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
}

const ACTIONS: Action[] = [
  { labelKey: 'newContact', href: '/contacts', icon: UserPlus, tint: 'text-primary' },
  { labelKey: 'newDeal', href: '/pipelines', icon: Briefcase, tint: 'text-blue-400' },
  { labelKey: 'newBroadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-400' },
  { labelKey: 'newAutomation', href: '/automations/new', icon: Zap, tint: 'text-primary' },
  { labelKey: 'numberHealth', href: '/number-health', icon: HeartPulse, tint: 'text-primary' },
]

/**
 * Current quality rating for the Number health button's second line.
 * Best effort: any failure just leaves the button without the line.
 */
function useQualityRating(): QualityRating | null {
  const [rating, setRating] = useState<QualityRating | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/number-health?light=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.health?.quality_rating) {
          setRating(body.health.quality_rating as QualityRating)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return rating
}

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions')
  const rating = useQualityRating()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        const isHealth = a.labelKey === 'numberHealth'
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card transition-colors hover:bg-card-2"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${a.tint}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">{t(a.labelKey as string)}</span>
              {isHealth && rating && (
                <span className="text-xs text-muted-foreground">
                  {t('qualityLine', { rating: t(`rating_${rating}`) })}
                </span>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
