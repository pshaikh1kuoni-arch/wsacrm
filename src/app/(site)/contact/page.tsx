import type { Metadata } from 'next'

import { InlineLink, LegalPage, LegalSection } from '@/components/marketing/legal-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach WAGenie.',
}

export default function ContactPage() {
  return (
    <LegalPage current="contact" title="Contact us">
      <p>We read every message. We try to reply within 2 business days.</p>

      <LegalSection title="Business details">
        <address className="flex flex-col gap-1 not-italic">
          <span className="font-semibold text-[var(--wink)]">WAGenie</span>
          <span>Operated by {SITE.operator}</span>
          {SITE.addressLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
      </LegalSection>

      <LegalSection title="Email">
        <p>
          <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink>
        </p>
        {SITE.phone ? (
          <p>
            Phone: <InlineLink href={`tel:${SITE.phone}`}>{SITE.phone}</InlineLink>
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="What to include">
        <p>
          For a payment question, please include your receipt number (it looks like WAG-000123) and the email you
          signed up with. For a technical problem, tell us what you were doing and what you saw.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
