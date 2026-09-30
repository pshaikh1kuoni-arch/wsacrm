import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { QualityRating } from '@/lib/whatsapp/number-health'

// Colour is never the only signal: each rating also shows its own word.
const STYLES: Record<QualityRating, string> = {
  high: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-red-500/15 text-red-700 dark:text-red-400',
  unknown: 'bg-muted text-muted-foreground',
}

export function QualityBadge({
  rating,
  large = false,
}: {
  rating: QualityRating
  large?: boolean
}) {
  const t = useTranslations('NumberHealth')
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full font-semibold',
        large ? 'px-4 py-1.5 text-2xl' : 'px-2.5 py-0.5 text-xs',
        STYLES[rating],
      )}
    >
      {t(`rating_${rating}`)}
    </span>
  )
}
