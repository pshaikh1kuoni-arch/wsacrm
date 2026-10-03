// The public site's frame: the floating navigation pill, the footer,
// and a shell that wraps a page in the landing page's look. Shared by
// the homepage and every public page (pricing, terms, privacy,
// refunds, delivery, about, contact), so they cannot drift apart.
//
// No hooks and no browser APIs, so server pages can use it directly.

import Image from 'next/image'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { ADDRESS_ONE_LINE, SITE } from '@/lib/site'
import { cn } from '@/lib/utils'

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 p-4">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-full border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-3 py-2.5 pl-5 shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/wagenie-logo.png" alt="WAGenie" width={172} height={31} className="h-7 w-auto" priority />
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-[var(--wink-soft)] md:flex">
          <Link href="/#tour" className="hover:text-[var(--wink)]">Product</Link>
          <Link href="/#features" className="hover:text-[var(--wink)]">Features</Link>
          <Link href="/#hub" className="hover:text-[var(--wink)]">AI</Link>
          <Link href="/pricing" className="hover:text-[var(--wink)]">Pricing</Link>
          <Link href="/#faq" className="hover:text-[var(--wink)]">FAQ</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-[var(--wink)] hover:bg-[var(--wsurface-2)]')}>
            Login
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: 'gradient', size: 'sm' })}>
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  )
}

const footerHeading = 'mb-3.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase'
const footerLink = 'mb-2 block hover:text-[var(--wink)]'

export function SiteFooter() {
  return (
    <footer className="relative z-10 mx-auto max-w-[1180px] px-6 py-14 text-[13.5px] text-[var(--wink-soft)]">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.3fr_1fr_1.2fr_1fr]">
        <div>
          <Image src="/brand/wagenie-logo.png" alt="WAGenie" width={172} height={31} className="mb-3 h-9 w-auto" />
          <p className="max-w-[240px]">One AI, one inbox, every WhatsApp message your business sends.</p>
        </div>
        <div>
          <h5 className={footerHeading}>Contact</h5>
          <p className="mb-2 font-medium text-[var(--wink)]">{SITE.operator}</p>
          <p className="mb-2">{ADDRESS_ONE_LINE}</p>
          <a href={`mailto:${SITE.email}`} className={footerLink}>{SITE.email}</a>
          {SITE.phone ? <a href={`tel:${SITE.phone}`} className={footerLink}>{SITE.phone}</a> : null}
        </div>
        <div>
          <h5 className={footerHeading}>Company</h5>
          <Link href="/about" className={footerLink}>About</Link>
          <Link href="/contact" className={footerLink}>Contact</Link>
          <Link href="/pricing" className="block hover:text-[var(--wink)]">Pricing</Link>
        </div>
        <div>
          <h5 className={footerHeading}>Legal</h5>
          <Link href="/terms" className={footerLink}>Terms and Conditions</Link>
          <Link href="/privacy" className={footerLink}>Privacy Policy</Link>
          <Link href="/refund" className={footerLink}>Cancellation and Refunds</Link>
          <Link href="/delivery" className="block hover:text-[var(--wink)]">Delivery</Link>
        </div>
        <div>
          <h5 className={footerHeading}>Get started</h5>
          <Link href="/login" className={footerLink}>Login</Link>
          <Link href="/signup" className="block hover:text-[var(--wink)]">Get Started</Link>
        </div>
      </div>
      <div className="mt-11 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--wglass-edge)] pt-5.5">
        <span>© 2026 WAGenie. Operated by {SITE.operator}, Mumbai. All rights reserved.</span>
        <span>
          <Link href="/privacy" className="mr-4 hover:text-[var(--wink)]">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--wink)]">Terms</Link>
        </span>
      </div>
    </footer>
  )
}

/** The page frame for every public page except the homepage. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wag-landing relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-36 h-[520px] w-[520px] rounded-full bg-primary opacity-[.22] blur-[90px]" />
        <div className="absolute top-28 -right-40 h-[460px] w-[460px] rounded-full bg-primary-2 opacity-[.26] blur-[90px]" />
      </div>
      <SiteNav />
      <main className="relative z-10">{children}</main>
      <SiteFooter />
    </div>
  )
}
