import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'

import { DISPLAY_FONT } from '@/components/marketing/shared'
import { InlineLink } from '@/components/marketing/legal-page'
import { buttonVariants } from '@/components/ui/button'
import { PRICE_LABEL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'One plan, everything included: WAGenie for ₹2,500 per month.',
}

// Only features that exist in the product today. The order and payment
// features are not listed because they are not built yet.
const INCLUDED = [
  {
    title: 'Shared WhatsApp inbox',
    text: 'One number for the whole team, with live updates, assignment, quick replies, voice notes and media.',
  },
  {
    title: 'Contacts, tags and custom fields',
    text: 'Import from a CSV file and organise your customers your way.',
  },
  {
    title: 'Sales pipelines',
    text: 'Kanban boards for your deals, with values and stages.',
  },
  {
    title: 'Broadcast campaigns',
    text: 'Send approved templates to a chosen audience and see who read and replied.',
  },
  {
    title: 'Automations and Flows',
    text: 'Build chatbots and follow ups with a visual builder.',
  },
  {
    title: 'AI agents',
    text: 'Draft replies, auto reply and a knowledge base. You bring your own AI key.',
  },
  {
    title: 'Product catalogue in chat',
    text: 'Send products from your Meta catalogue and receive a customer basket.',
  },
  {
    title: 'Team roles and invites',
    text: 'Owner, admin, agent and viewer, with invite links.',
  },
  {
    title: 'Dashboard and number health',
    text: 'Conversation reports, WhatsApp quality rating, usage and cost.',
  },
  {
    title: 'API, webhooks and MCP',
    text: 'Connect your own systems.',
  },
] as const

const QUESTIONS = [
  {
    q: 'How do I pay?',
    a: 'After you sign in, go to Settings, Billing and pay with Razorpay using UPI, a card or netbanking. You get a receipt for each payment.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, at any time. Your access continues until the end of the month you paid for.',
    link: { href: '/refund', label: 'Cancellation and Refunds' },
  },
  {
    q: 'Is anything shipped to me?',
    a: 'No. WAGenie is a software service. Access starts online as soon as your payment is confirmed.',
    link: { href: '/delivery', label: 'Delivery' },
  },
] as const

export default function PricingPage() {
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-8 px-6 pt-12 pb-6">
      <div className="flex flex-col gap-3 text-center">
        <h1 className={`${DISPLAY_FONT} text-[2.2rem] leading-tight font-bold tracking-tight text-[var(--wink)] sm:text-5xl`}>
          Simple pricing for your WhatsApp team
        </h1>
        <p className="text-lg text-[var(--wink-soft)]">
          One plan with everything included. Pay monthly. Cancel any time.
        </p>
      </div>

      <div className="flex w-full max-w-[940px] flex-col overflow-hidden rounded-[28px] bg-[var(--wsurface)] shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] md:flex-row">
        <div className="flex flex-col gap-4 bg-[var(--wsurface-2)] p-9 md:w-[360px] md:shrink-0">
          <span className="text-sm font-semibold text-primary">WAGenie Standard</span>
          <div className="flex items-baseline gap-2">
            <span className={`${DISPLAY_FONT} text-6xl font-bold tracking-tight text-[var(--wink)]`}>{PRICE_LABEL}</span>
            <span className="text-[var(--wink-soft)]">per month</span>
          </div>
          <span className="text-[13px] text-[var(--wink-soft)]">Plus GST as applicable. Billed monthly.</span>
          <Link href="/signup" className={`${buttonVariants({ variant: 'gradient', size: 'lg' })} h-12 justify-center rounded-full text-[15px]`}>
            Get Started
          </Link>
          <span className="text-[13px] text-[var(--wink-soft)]">
            Already a customer? <InlineLink href="/login">Log in</InlineLink>
          </span>
          <div className="mt-auto flex flex-col gap-1.5 border-t border-[var(--wglass-edge)] pt-4 text-[13px] text-[var(--wink-soft)]">
            <span className="font-semibold text-[var(--wink)]">Pay securely with Razorpay</span>
            <span>UPI, cards and netbanking. We never see or store your card details.</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 p-9">
          <span className="text-sm font-semibold text-[var(--wink)]">Everything included</span>
          {INCLUDED.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
              <div className="flex flex-col">
                <span className="font-semibold text-[var(--wink)]">{f.title}</span>
                <span className="text-[13px] text-[var(--wink-soft)]">{f.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-[940px] flex-col gap-2 rounded-[20px] border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-7 py-5 backdrop-blur-xl sm:flex-row sm:gap-4">
        <span className="font-semibold whitespace-nowrap text-[var(--wink)]">Not included</span>
        <span className="text-[var(--wink-soft)]">
          WhatsApp message charges are billed by Meta to your own WhatsApp Business account. AI usage is billed by
          your AI provider, because you bring your own key.
        </span>
      </div>

      <div className="flex w-full max-w-[940px] flex-col gap-3">
        <h2 className={`${DISPLAY_FONT} text-2xl font-bold text-[var(--wink)]`}>Questions</h2>
        {QUESTIONS.map((item) => (
          <div key={item.q} className="flex flex-col gap-1 rounded-[18px] bg-[var(--wsurface)] px-6 py-4.5">
            <span className="font-semibold text-[var(--wink)]">{item.q}</span>
            <span className="text-[var(--wink-soft)]">
              {item.a}
              {'link' in item ? (
                <>
                  {' '}
                  See <InlineLink href={item.link.href}>{item.link.label}</InlineLink>.
                </>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
