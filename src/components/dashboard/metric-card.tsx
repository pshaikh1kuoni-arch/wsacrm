import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

interface MetricCardProps {
  title: string
  /** Raw numeric value — animated via count-up, then run through `format`. */
  value: number
  /** Defaults to a plain `toLocaleString()`; pass e.g. a currency formatter. */
  format?: (n: number) => string
  icon: ComponentType<{ className?: string }>
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
  /**
   * Renders as the gradient "hero" tile instead of a neutral card.
   * Exactly one tile in the row should be highlighted at a time — the
   * one the user picked (see `onClick`), or a sensible default before
   * they've picked anything.
   */
  highlight?: boolean
  /**
   * Selecting a tile only changes which one is highlighted — it's a
   * "what am I focused on" indicator, not a filter. Nothing else on
   * the dashboard reacts to it. Omit to render as a static (non-
   * clickable) tile.
   */
  onClick?: () => void
  /** Stagger delay (ms) for this tile's entrance animation on mount. */
  enterDelayMs?: number
}

export function MetricCard({
  title,
  value,
  format = (n) => Math.round(n).toLocaleString(),
  icon: Icon,
  delta,
  subtitle,
  highlight,
  onClick,
  enterDelayMs = 0,
}: MetricCardProps) {
  const animatedValue = useCountUp(value)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ animationDelay: `${enterDelayMs}ms` }}
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-400 ease-out rounded-2xl p-5 text-left shadow-card transition-transform',
        highlight ? 'bg-gradient-hero' : 'bg-card',
        onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
      )}
    >
      <div className="flex items-start justify-between">
        <p className={cn('text-sm font-medium', highlight ? 'text-white/85' : 'text-muted-foreground')}>
          {title}
        </p>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            highlight ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p
        className={cn(
          'mt-3 text-[28px] leading-none font-bold tabular-nums',
          highlight ? 'text-white' : 'text-foreground',
        )}
      >
        {format(animatedValue)}
      </p>
      {delta ? (
        <DeltaRow sign={delta.sign} label={delta.label} highlight={highlight} />
      ) : subtitle ? (
        <p className={cn('mt-2 text-sm', highlight ? 'text-white/85' : 'text-muted-foreground')}>
          {subtitle}
        </p>
      ) : null}
    </button>
  )
}

function DeltaRow({ sign, label, highlight }: { sign: number; label: string; highlight?: boolean }) {
  const tone = highlight
    ? 'text-white/90'
    : sign > 0
    ? 'text-primary'
    : sign < 0
    ? 'text-red-400'
    : 'text-muted-foreground'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-sm', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
