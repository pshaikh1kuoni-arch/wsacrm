import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function Tile({
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

export function EmptyCard({
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
