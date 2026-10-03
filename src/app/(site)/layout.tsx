import { SiteShell } from '@/components/marketing/site-chrome'

// Public pages (pricing, terms, privacy, refunds, delivery, about,
// contact) share the homepage's frame. These routes need no login.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
