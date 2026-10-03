import type { Metadata } from 'next'

import {
  InlineLink,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/components/marketing/legal-page'
import { ADDRESS_ONE_LINE, SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How WAGenie collects, uses and protects your data.',
}

export default function PrivacyPage() {
  return (
    <LegalPage current="privacy" title="Privacy Policy" updated={SITE.legalUpdated}>
      <p>
        This policy explains what information WAGenie collects, why, and what you can do about it. WAGenie is run
        by {SITE.operator}, {ADDRESS_ONE_LINE}. We follow the Digital Personal Data Protection Act, 2023 of India.
      </p>

      <LegalSection title="1. Two kinds of information">
        <LegalList>
          <li>
            <strong className="text-[var(--wink)]">Your account.</strong> Your name, email address, password
            (stored only in scrambled form) and your payment receipts. For this we decide why and how it is used.
          </li>
          <li>
            <strong className="text-[var(--wink)]">Your workspace.</strong> The contacts, conversations,
            messages, templates, deals and files that you and your team put into WAGenie. You decide what goes in.
            We handle it only to run the service for you.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <LegalList>
          <li>Account details: name, email, role in your workspace, profile photo if you add one.</li>
          <li>Workspace content: contacts and their phone numbers, WhatsApp messages and media, notes, tags, deals.</li>
          <li>Connection details for WhatsApp and for your AI provider. These keys are stored encrypted.</li>
          <li>Payment records: receipt number, amount, date and the Razorpay payment reference. We do not store card, UPI or bank details.</li>
          <li>Basic technical logs, such as errors and request times, to keep the service working and safe.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. How we use it">
        <LegalList>
          <li>To run WAGenie, show your inbox and send the messages you ask us to send.</li>
          <li>To take payment for the subscription and issue receipts.</li>
          <li>To keep the service secure, fix problems and prevent misuse.</li>
          <li>To contact you about your account, such as a payment problem or an important change.</li>
        </LegalList>
        <p>We do not sell your data. We do not use your workspace content for advertising.</p>
      </LegalSection>

      <LegalSection title="4. Who else handles it">
        <p>We use trusted services to run WAGenie. Each receives only what it needs.</p>
        <LegalList>
          <li><strong className="text-[var(--wink)]">Supabase</strong> for the database and login.</li>
          <li><strong className="text-[var(--wink)]">Vercel</strong> for hosting.</li>
          <li><strong className="text-[var(--wink)]">Razorpay</strong> for subscription payments.</li>
          <li><strong className="text-[var(--wink)]">Meta (WhatsApp)</strong> to send and receive your WhatsApp messages.</li>
          <li>
            <strong className="text-[var(--wink)]">Your AI provider</strong>, if you switch on the AI features.
            You choose the provider and supply the key. Message text you ask the AI to read is sent to it.
          </li>
        </LegalList>
        <p>We may also share information when the law requires it.</p>
      </LegalSection>

      <LegalSection title="5. How we protect it">
        <LegalList>
          <li>Connections use HTTPS.</li>
          <li>Access tokens and keys are encrypted before they are stored.</li>
          <li>Each workspace is separated from the others by database rules, so one business cannot see another&apos;s data.</li>
          <li>Roles control who inside a workspace can see or change what.</li>
        </LegalList>
        <p>No system is perfectly safe, but we work to keep your data protected.</p>
      </LegalSection>

      <LegalSection title="6. How long we keep it">
        <p>
          We keep your information while your account is open. If you ask us to delete your account, we delete your
          workspace data within 30 days. We keep payment records for as long as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>You can ask us to:</p>
        <LegalList>
          <li>show you the personal information we hold about you,</li>
          <li>correct information that is wrong,</li>
          <li>delete your information, and</li>
          <li>take back a permission you gave us.</li>
        </LegalList>
        <p>
          If you are a business using WAGenie, the people in your contacts should ask you first, because you decide
          why their information is in your workspace.
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          We use cookies only to keep you logged in and to remember your choices, such as light or dark mode. We do
          not use advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>WAGenie is for businesses. It is not meant for anyone under 18.</p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          If we change this policy, we will update the date at the top. For a change that matters, we will tell you
          by email.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact and complaints">
        <p>
          To use your rights or make a complaint, write to {SITE.operator} at{' '}
          <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink>, or by post to {ADDRESS_ONE_LINE}. We
          will reply within 30 days.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
