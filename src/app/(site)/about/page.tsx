import type { Metadata } from 'next'

import {
  InlineLink,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/components/marketing/legal-page'
import { ADDRESS_ONE_LINE, SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description: 'WAGenie is a WhatsApp CRM for growing businesses, made in Mumbai.',
}

export default function AboutPage() {
  return (
    <LegalPage current="about" title="About WAGenie">
      <p>
        WAGenie is a WhatsApp CRM. It gives a business one shared inbox for every WhatsApp conversation, with the
        contacts, deals, campaigns and automations around it, and AI that helps the team reply faster.
      </p>

      <LegalSection title="What we do">
        <LegalList>
          <li>One WhatsApp number, shared by your whole team, with live updates.</li>
          <li>Contacts, tags and sales pipelines that sit next to the chat.</li>
          <li>Broadcast campaigns with approved WhatsApp templates.</li>
          <li>Automations and chatbot flows, and AI helpers that you control.</li>
          <li>Your product catalogue in the chat, and customer baskets that arrive in the inbox.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Who runs it">
        <p>
          WAGenie is run by {SITE.operator} from {ADDRESS_ONE_LINE}. We build it for businesses in India that sell
          and support their customers on WhatsApp.
        </p>
      </LegalSection>

      <LegalSection title="Talk to us">
        <p>
          See the <InlineLink href="/pricing">Pricing</InlineLink> page, or write to us through the{' '}
          <InlineLink href="/contact">Contact</InlineLink> page.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
