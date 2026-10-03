// The layout for the text pages: Terms, Privacy, Cancellation and
// Refunds, Delivery, About and Contact. A list of the pages on the left,
// the page itself in a card on the right.

import Link from 'next/link'

import { cn } from '@/lib/utils'
import { DISPLAY_FONT } from './shared'

export type LegalSlug = 'terms' | 'privacy' | 'refund' | 'delivery' | 'about' | 'contact'

const LEGAL_LINKS: { slug: LegalSlug; href: string; label: string }[] = [
  { slug: 'terms', href: '/terms', label: 'Terms and Conditions' },
  { slug: 'privacy', href: '/privacy', label: 'Privacy Policy' },
  { slug: 'refund', href: '/refund', label: 'Cancellation and Refunds' },
  { slug: 'delivery', href: '/delivery', label: 'Delivery' },
]

const COMPANY_LINKS: { slug: LegalSlug | 'pricing'; href: string; label: string }[] = [
  { slug: 'about', href: '/about', label: 'About' },
  { slug: 'contact', href: '/contact', label: 'Contact' },
  { slug: 'pricing', href: '/pricing', label: 'Pricing' },
]

function SideLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-xl px-2.5 py-2 text-sm',
        active
          ? 'bg-[var(--wsurface-2)] font-semibold text-[var(--wink)]'
          : 'text-[var(--wink-soft)] hover:text-[var(--wink)]',
      )}
    >
      {label}
    </Link>
  )
}

export function LegalPage({
  current,
  title,
  updated,
  children,
}: {
  current: LegalSlug
  title: string
  /** Shown as "Last updated …". Leave out for About and Contact. */
  updated?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6 pt-10 pb-4 lg:flex-row lg:items-start lg:gap-14">
      <aside
        aria-label="Pages"
        className="flex w-full shrink-0 flex-col gap-1 rounded-[20px] border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] p-5 backdrop-blur-xl lg:w-[260px]"
      >
        <span className="mb-1.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Legal</span>
        {LEGAL_LINKS.map((l) => (
          <SideLink key={l.slug} href={l.href} label={l.label} active={l.slug === current} />
        ))}
        <span className="mt-4 mb-1.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Company</span>
        {COMPANY_LINKS.map((l) => (
          <SideLink key={l.slug} href={l.href} label={l.label} active={l.slug === current} />
        ))}
      </aside>

      <article className="min-w-0 flex-1 rounded-[28px] bg-[var(--wsurface)] p-8 shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] sm:p-12">
        <h1 className={`${DISPLAY_FONT} text-[2rem] leading-tight font-bold tracking-tight text-[var(--wink)] sm:text-[2.5rem]`}>
          {title}
        </h1>
        {updated ? (
          <p className="mt-2 text-sm text-[var(--wink-faint)]">Last updated {updated}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-7 text-[15px] leading-relaxed text-[var(--wink-soft)]">
          {children}
        </div>
      </article>
    </div>
  )
}

/** A numbered or plain section inside a legal page. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-xl font-semibold text-[var(--wink)]">{title}</h2>
      {children}
    </section>
  )
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 flex list-disc flex-col gap-1.5">{children}</ul>
}

export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('mailto:') || href.startsWith('http')
  return external ? (
    <a href={href} className="font-semibold text-primary hover:underline">{children}</a>
  ) : (
    <Link href={href} className="font-semibold text-primary hover:underline">{children}</Link>
  )
}
