import type { Metadata } from 'next'

import {
  InlineLink,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/components/marketing/legal-page'
import { ADDRESS_ONE_LINE, PRICE_LABEL, SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'The terms for using WAGenie, the WhatsApp CRM.',
}

export default function TermsPage() {
  return (
    <LegalPage current="terms" title="Terms and Conditions" updated={SITE.legalUpdated}>
      <p>
        These terms are an agreement between you and {SITE.operator}, who runs WAGenie from {ADDRESS_ONE_LINE}.
        By creating an account, or by paying for the service, you accept them. If you do not accept them, please do
        not use WAGenie.
      </p>

      <LegalSection title="1. The service">
        <p>
          WAGenie is software for managing a business&apos;s WhatsApp conversations. It includes a shared inbox,
          contacts, sales pipelines, broadcast campaigns, automations, chatbot flows, AI helpers, a product
          catalogue in chat, team roles and a developer API. The service is delivered online. Nothing is shipped.
          See <InlineLink href="/delivery">Delivery</InlineLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <LegalList>
          <li>You must give correct details and keep your password and access tokens private.</li>
          <li>You are responsible for everything done through your account, including by the people you invite.</li>
          <li>You must be at least 18 years old and able to enter a binding contract in India.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Subscription and payment">
        <LegalList>
          <li>The subscription costs {PRICE_LABEL} per month, plus GST as applicable.</li>
          <li>It is paid one month at a time, in advance, through Razorpay, using UPI, a card or netbanking.</li>
          <li>We never see or store your card details. Razorpay handles them.</li>
          <li>Access starts when Razorpay confirms your payment. Each paid month adds one month of access.</li>
          <li>We may change the price. A change applies from your next payment, and we will tell you first.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Cancellation and refunds">
        <p>
          You can cancel at any time. Please read <InlineLink href="/refund">Cancellation and Refunds</InlineLink>{' '}
          for the details.
        </p>
      </LegalSection>

      <LegalSection title="5. What you may not do">
        <LegalList>
          <li>Send spam, or message people who have not agreed to hear from you.</li>
          <li>Send anything illegal, harmful, misleading or abusive.</li>
          <li>Try to break, overload or get into parts of the service you do not own.</li>
          <li>Resell the service without our written permission.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. WhatsApp and Meta rules">
        <p>
          WAGenie connects to your own WhatsApp Business account. You must follow the WhatsApp Business and Meta
          policies, including their rules on opt in, message templates and quality. Meta charges you directly for
          WhatsApp messages. Meta can limit or block a number, and we are not responsible for what Meta decides.
        </p>
      </LegalSection>

      <LegalSection title="7. AI features">
        <p>
          The AI helpers use an AI provider that you choose, with your own key. The provider bills you directly. AI
          can make mistakes, so please check what it writes before you rely on it.
        </p>
      </LegalSection>

      <LegalSection title="8. Your data">
        <p>
          Your contacts, conversations and files belong to you. We handle them only to run the service for you, as
          described in our <InlineLink href="/privacy">Privacy Policy</InlineLink>. You are responsible for having
          the right to message the people in your account.
        </p>
      </LegalSection>

      <LegalSection title="9. Availability and changes">
        <p>
          We work to keep WAGenie available, but we cannot promise it will never be interrupted. We may improve,
          change or remove features. We will try to give notice of changes that matter.
        </p>
      </LegalSection>

      <LegalSection title="10. Our responsibility">
        <p>
          WAGenie is provided as it is. To the extent the law allows, we are not responsible for indirect losses,
          lost profit, or problems caused by Meta, Razorpay, your AI provider or your internet connection. Our total
          responsibility to you for any claim is limited to the amount you paid us in the three months before the
          claim.
        </p>
      </LegalSection>

      <LegalSection title="11. Ending the agreement">
        <p>
          You can stop using WAGenie at any time. We may suspend or end an account that breaks these terms, or that
          puts other users or the service at risk. You can ask us to export or delete your data, as described in
          the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing law">
        <p>
          These terms follow the laws of India. Any dispute will be decided by the courts in Mumbai, Maharashtra.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these terms: <InlineLink href={`mailto:${SITE.email}`}>{SITE.email}</InlineLink>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
