import type { Metadata } from 'next'

import {
  InlineLink,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/components/marketing/legal-page'
import { PRICE_LABEL, SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Cancellation and Refunds',
  description: 'How to cancel WAGenie and when you can get a refund.',
}

export default function RefundPage() {
  return (
    <LegalPage current="refund" title="Cancellation and Refunds" updated={SITE.legalUpdated}>
      <p>
        We want you to be happy with WAGenie. This page explains how cancelling works and when we refund a payment.
      </p>

      <LegalSection title="1. Cancelling">
        <LegalList>
          <li>You can cancel at any time. There is no cancellation fee.</li>
          <li>
            The subscription is paid one month at a time. If you do not pay again, it simply ends. Your access
            continues until the end of the month you already paid for.
          </li>
          <li>
            To close your account and have your data deleted, write to{' '}
            <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. Refunds">
        <LegalList>
          <li>
            <strong className="text-[var(--wink)]">First payment.</strong> If you ask within 7 days of your first
            payment of {PRICE_LABEL}, we refund it in full.
          </li>
          <li>
            <strong className="text-[var(--wink)]">Later months.</strong> A month that has already started is not
            refunded. You can cancel before the next payment.
          </li>
          <li>
            <strong className="text-[var(--wink)]">Charged by mistake.</strong> If you were charged twice, or
            charged an amount that is not the price, we refund the extra amount in full.
          </li>
          <li>
            <strong className="text-[var(--wink)]">Meta and AI charges.</strong> WhatsApp message charges are
            billed by Meta, and AI usage by your AI provider. We cannot refund those.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. How to ask for a refund">
        <p>
          Email <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink> with your receipt number (it
          looks like WAG-000123, and you can find it under Settings, Billing). We will reply within 3 business days.
        </p>
      </LegalSection>

      <LegalSection title="4. How long a refund takes">
        <p>
          Refunds go back to the way you paid, through Razorpay. Banks and card companies usually take 5 to 7
          business days to show the money.
        </p>
      </LegalSection>

      <LegalSection title="5. Payment failed but money left your account">
        <p>
          Sometimes a payment fails after the bank has already taken the money. In that case the bank or Razorpay
          normally returns it automatically within 5 to 7 business days. If it does not, write to us with the
          payment reference and we will help you trace it.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
