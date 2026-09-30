import { useTranslations } from 'next-intl'

export interface DailyRow {
  day: string
  inbound: number | string
  outbound: number | string
}

const CHART_HEIGHT = 180

/** Last `days` calendar days ending today, zero-filled, as yyyy-mm-dd keys. */
function lastDayKeys(days: number): string[] {
  const keys: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    keys.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return keys
}

export function DailyVolumeChart({
  rows,
  days = 30,
  goalLine,
}: {
  rows: DailyRow[]
  days?: number
  /** Optional dashed reference line (messages per day). */
  goalLine?: number
}) {
  const t = useTranslations('NumberHealth')
  const byDay = new Map(rows.map((r) => [r.day, Number(r.inbound) + Number(r.outbound)]))
  const series = lastDayKeys(days).map((key) => ({ key, total: byDay.get(key) ?? 0 }))
  const max = Math.max(1, goalLine ?? 0, ...series.map((s) => s.total))
  const hasData = series.some((s) => s.total > 0)

  if (!hasData) {
    return <p className="mt-4 text-sm text-muted-foreground">{t('chartEmpty')}</p>
  }

  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={t('chartAria', { days })}
        className="relative flex items-end gap-1 border-b border-border"
        style={{ height: CHART_HEIGHT }}
      >
        {goalLine !== undefined && (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-amber-600"
            style={{ bottom: (goalLine / max) * CHART_HEIGHT }}
          />
        )}
        {series.map((s) => (
          <div
            key={s.key}
            title={`${s.key}: ${s.total.toLocaleString()}`}
            className="min-w-0 flex-1 rounded-t bg-primary"
            style={{ height: Math.max(s.total > 0 ? 2 : 0, (s.total / max) * CHART_HEIGHT) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{t('daysAgo', { days })}</span>
        <span>{t('today')}</span>
      </div>
    </div>
  )
}
