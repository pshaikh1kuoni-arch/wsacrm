import type { Metadata } from 'next'

import {
  InlineLink,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/components/marketing/legal-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Delivery',
  description: 'WAGenie is a digital service. Nothing is shipped.',
}

export default function DeliveryPage() {
  return (
    <LegalPage current="delivery" title="Delivery" updated={SITE.legalUpdated}>
      <p>
        WAGenie is a software service that you use online. It is delivered digitally. No physical product is
        shipped, so a shipping policy does not apply.
      </p>

      <LegalSection title="How you get access">
        <LegalList>
          <li>Create an account on the website and sign in.</li>
          <li>Pay for your first month in Settings, Billing.</li>
          <li>As soon as Razorpay confirms the payment, your access starts. This usually takes a few seconds.</li>
          <li>Your receipt appears in Settings, Billing.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="If your access does not start">
        <p>
          If more than 24 hours pass after your payment and your access has not started, please write to{' '}
          <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink> with your receipt number. We will fix
          it, or refund you under our <InlineLink href="/refund">Cancellation and Refunds</InlineLink> page.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
