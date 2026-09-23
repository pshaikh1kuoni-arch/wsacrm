"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MessageSquare,
  Columns3,
  Radio,
  Zap,
  ShieldCheck,
  Users,
  Sparkles,
  Check,
  CircleAlert,
  Lock,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DISPLAY_FONT, Eyebrow, GradientText } from "./shared";
import { HubDiagramCard } from "./hub-diagram";

// Public marketing homepage (`/`). Self-contained: it reads the app's
// real --primary/--primary-2 accent tokens (so it always matches
// whichever theme is active) but otherwise uses its own scoped
// `.wag-landing` neutral tokens from globals.css — see the comment
// there for why it doesn't share the app's dark-default background.

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    body: "A shared inbox for multiple agents, with read receipts, session timers, quick replies, and saved templates.",
  },
  {
    icon: Users,
    title: "Contacts",
    body: "Custom fields, tags, company grouping, and CSV import, all kept as one record per customer.",
  },
  {
    icon: Columns3,
    title: "Pipelines",
    body: "Kanban deal boards with analytics for every stage, so a chat becomes a tracked deal in one click.",
  },
  {
    icon: Radio,
    title: "Broadcasts",
    body: "Segmented campaigns by tag, custom field, or CSV list, with a delivery/read/reply funnel.",
  },
  {
    icon: Zap,
    title: "Automations",
    body: "Workflows triggered by a keyword or a first message, with tagging, assignment, branching, and wait steps.",
  },
  {
    icon: Sparkles,
    title: "AI assisted replies",
    body: "Draft suggestions right in the composer, grounded in your own knowledge base.",
  },
  {
    icon: Users,
    title: "Team & roles",
    body: "Bring your whole team onto one WhatsApp number, with presence and assignment for every chat.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication messages",
    body: "OTP and verification templates, sent and tracked the same way as every other message.",
  },
] as const;

const FAQS = [
  {
    q: "Do I need the official WhatsApp Business API?",
    a: "Yes. WAGenie connects to your official WhatsApp Business API account, and that is what lets Marketing, Utility, and Authentication templates send reliably at scale.",
  },
  {
    q: "Can more than one person reply from the same number?",
    a: "Yes, that is the whole point. Every teammate gets their own login into one shared inbox, with assignment for every chat, so nothing gets answered twice.",
  },
  {
    q: "What happens to my existing contacts and chat history?",
    a: "You can import your contact list directly. What happens to your conversation history depends on what your current provider can export.",
  },
  {
    q: "Is there a free trial?",
    a: "Reach out and we will set one up for your team.",
  },
  {
    q: "Is my data private to my business only?",
    a: "Yes. Every workspace is isolated, and nothing is shared across accounts.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="wag-landing relative min-h-screen overflow-x-clip">
      {/* Ambient mesh background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -left-36 h-[520px] w-[520px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full bg-primary opacity-[.28] blur-[90px]" />
        <div className="absolute top-28 -right-40 h-[460px] w-[460px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full bg-primary-2 opacity-[.28] blur-[90px] [animation-delay:-8s]" />
        <div className="absolute top-[900px] -left-52 h-[480px] w-[480px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full bg-primary-2 opacity-[.28] blur-[90px] [animation-delay:-16s]" />
        <div className="absolute top-[1500px] -right-44 h-[520px] w-[520px] animate-[wag-drift_26s_ease-in-out_infinite] rounded-full bg-primary opacity-[.28] blur-[90px] [animation-delay:-4s]" />
      </div>

      <NavBar />

      <main className="relative z-10">
        <Hero />
        <TrustStrip />
        <ProductTour />
        <FeatureGrid />
        <HubDiagram />
        <Comparison />
        <HowItWorks />
        <FAQ />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 p-4">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-full border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-3 py-2.5 pl-5 shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/brand/wagenie-logo.png" alt="WAGenie" width={172} height={31} className="h-7 w-auto" priority />
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-[var(--wink-soft)] md:flex">
          <a href="#tour" className="hover:text-[var(--wink)]">Product</a>
          <a href="#features" className="hover:text-[var(--wink)]">Features</a>
          <a href="#hub" className="hover:text-[var(--wink)]">AI</a>
          <a href="#faq" className="hover:text-[var(--wink)]">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-[var(--wink)] hover:bg-[var(--wsurface-2)]")}>
            Login
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "gradient", size: "sm" })}>
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 pt-16 pb-10">
      <div className="grid items-center gap-14 md:grid-cols-[1.05fr_.95fr]">
        <div className="text-center md:text-left">
          <Eyebrow>Powered by AI, built for WhatsApp</Eyebrow>
          <h1 className={`${DISPLAY_FONT} text-[2.1rem] leading-[1.05] font-bold tracking-tight text-[var(--wink)] sm:text-5xl lg:text-[3.6rem]`}>
            Your WhatsApp business,
            <br />
            run by an <GradientText>AI Genie</GradientText>.
          </h1>
          <p className="mx-auto mt-5 max-w-[480px] text-lg text-[var(--wink-soft)] md:mx-0">
            WAGenie handles your Marketing templates, Utility updates, and Authentication messages, while your whole team works from one shared inbox, one pipeline, and one login.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link href="/login" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "h-11 px-6 text-[15px]")}>
              Login
            </Link>
            <a
              href="#tour"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 border-transparent bg-[var(--wsurface-2)] px-6 text-[15px] text-[var(--wink)] hover:bg-[var(--wsurface)]"
              )}
            >
              See how it works ↓
            </a>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3.5 text-[13.5px] text-[var(--wink-faint)] md:justify-start">
            <div className="flex">
              {["A", "R", "S"].map((l, i) => (
                <span
                  key={l}
                  className="grid h-6.5 w-6.5 place-items-center rounded-full border-2 bg-gradient-to-br from-primary to-primary-2 text-[9px] font-bold text-primary-foreground"
                  style={{ marginLeft: i === 0 ? 0 : -8, borderColor: "var(--wbg)" }}
                >
                  {l}
                </span>
              ))}
            </div>
            <span>Built for teams who live in WhatsApp</span>
          </div>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="absolute -top-3.5 right-1.5 z-10 flex items-center gap-1.5 rounded-2xl border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-3.5 py-2 text-xs font-bold text-primary shadow-[0_16px_40px_-14px_var(--wshadow-2)] backdrop-blur-xl">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" /> AI Active
      </div>

      <div className="rounded-[26px] border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] p-3.5 shadow-[0_16px_40px_-14px_var(--wshadow-2),0_2px_10px_var(--wshadow-1)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 px-1.5 pt-1.5 pb-3.5">
          <div className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full bg-[var(--wsurface-2)] text-[15px]">🧞</div>
          <div className="min-w-0 flex-1">
            <b className="block text-sm text-[var(--wink)]">WAGenie AI</b>
            <span className="text-xs text-[var(--wink-faint)]">Replies in 2s · Verified</span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10.5px] font-bold text-primary">Meta Verified</span>
        </div>

        <div className="mb-2.5 max-w-[80%] rounded-2xl rounded-bl-[5px] bg-[var(--wsurface-2)] px-3.5 py-2.5 text-[13.5px] text-[var(--wink)]">
          Hi, I saw your ad for the pottery workshop. What does it include?
          <time className="mt-1 block text-[10px] opacity-60">10:24</time>
        </div>
        <div className="ml-auto mb-2.5 max-w-[80%] rounded-2xl rounded-br-[5px] bg-gradient-to-br from-primary to-primary-2 px-3.5 py-2.5 text-[13.5px] text-primary-foreground">
          Hi Meera! It includes 4 sessions, all materials, and a certificate. The next batch starts Monday. Want me to hold you a seat?
          <time className="mt-1 block text-[10px] opacity-75">10:24</time>
        </div>

        <div className="rounded-2xl bg-[var(--wsurface)] p-3 shadow-[0_6px_18px_-10px_var(--wshadow-2)]">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--wink-soft)]">
            <span>MARKETING TEMPLATE</span>
            <span>Seen ✓✓</span>
          </div>
          <div className="mt-1 text-[13.5px] font-bold text-[var(--wink)]">New batch starting Monday</div>
          <div className="mt-2.5 text-xs font-bold text-primary">Reserve your seat →</div>
        </div>
      </div>

      <div className="mx-auto -mt-2 flex w-max items-center gap-1.5 rounded-2xl border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-3.5 py-2 text-xs font-bold text-primary shadow-[0_16px_40px_-14px_var(--wshadow-2)] backdrop-blur-xl">
        <Lock className="h-3.5 w-3.5" /> Auth OTP sent
      </div>
    </div>
  );
}

function TrustStrip() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-10">
      <p className="mb-5 text-center text-[13px] tracking-wide text-[var(--wink-faint)] uppercase">
        Built for teams who live in WhatsApp
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-32 rounded-xl bg-[var(--wsurface-2)] opacity-70" />
        ))}
      </div>
    </section>
  );
}

function ProductTour() {
  return (
    <section id="tour" className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <Eyebrow>Product tour</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>
          One login. Every part of the conversation.
        </h2>
        <p className="mt-3.5 text-[17px] text-[var(--wink-soft)]">
          Not three separate tools stitched together. One app that already knows the contact, the deal, and the next step.
        </p>
      </div>

      <div className="flex flex-col gap-16">
        <TourItem
          num="01 · INBOX"
          title="A shared inbox your whole team can work from"
          body={`Every teammate sees the same conversations, contact history, and status, so nobody has to ask who replied to this.`}
        >
          <InboxMock />
        </TourItem>

        <TourItem
          reverse
          num="02 · PIPELINE"
          title="A pipeline that lives next to the chat"
          body="Turn a conversation into a deal without leaving WhatsApp. Track stage, value, and who owns it."
        >
          <PipelineMock />
        </TourItem>

        <TourItem
          num="03 · AUTOMATIONS"
          title="Automations that actually fire"
          body="Automatically tag, assign, or reply to the first message, or wait and follow up later. All built visually, with no code."
        >
          <AutomationMock />
        </TourItem>
      </div>
    </section>
  );
}

function TourItem({
  num,
  title,
  body,
  reverse,
  children,
}: {
  num: string;
  title: string;
  body: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid items-center gap-12 md:grid-cols-2 ${reverse ? "[&>*:first-child]:md:order-2" : ""}`}>
      <div>
        <span className="font-mono text-[13px] font-semibold text-primary">{num}</span>
        <h3 className="mt-2 text-2xl font-bold text-[var(--wink)]">{title}</h3>
        <p className="mt-3 max-w-[440px] text-base text-[var(--wink-soft)]">{body}</p>
      </div>
      <div className="rounded-3xl bg-[var(--wsurface)] p-5 shadow-[0_1px_2px_var(--wshadow-1),0_12px_28px_-16px_var(--wshadow-2)] transition-transform duration-300 hover:-translate-y-1.5">
        {children}
      </div>
    </div>
  );
}

function InboxMock() {
  return (
    <div className="grid h-[230px] grid-cols-[120px_1fr] gap-2.5">
      <div className="flex flex-col gap-1.5 rounded-2xl bg-[var(--wsurface-2)]/60 p-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-2 p-1.5">
          <div className="h-5 w-5 shrink-0 rounded-full bg-white/30" />
          <div className="flex-1 space-y-1">
            <i className="block h-1.5 w-[70%] rounded bg-white/55" />
            <i className="block h-1.5 w-[45%] rounded bg-white/55" />
          </div>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-1.5 p-1.5">
            <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--wsurface)]" />
            <div className="flex-1 space-y-1">
              <i className="block h-1.5 w-[75%] rounded bg-[var(--wglass-edge)]" />
              <i className="block h-1.5 w-[40%] rounded bg-[var(--wglass-edge)]" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-end gap-2 rounded-2xl bg-[var(--wsurface)] p-3">
        <div className="max-w-[90%] rounded-2xl bg-[var(--wsurface-2)] px-3.5 py-2.5 text-[13px] text-[var(--wink)]">
          Can I get this in Matte Black?
        </div>
        <div className="ml-auto max-w-[90%] rounded-2xl bg-gradient-to-br from-primary to-primary-2 px-3.5 py-2.5 text-[13px] text-primary-foreground">
          Yes, it&apos;s in stock and ships today.
        </div>
      </div>
    </div>
  );
}

function PipelineMock() {
  const cols = [
    { name: "New", deals: [{ title: "Rahul Studio", value: "₹18,000", tone: "from-primary to-primary" }] },
    {
      name: "In talks",
      deals: [
        { title: "Verve Cafe", value: "₹42,500", tone: "from-primary-2 to-primary-2" },
        { title: "Nikhil M.", value: "₹9,200", tone: "from-primary-2 to-primary-2" },
      ],
    },
    { name: "Won", deals: [{ title: "Aroma Salon", value: "₹27,000", tone: "from-blue-500 to-blue-500" }] },
  ];
  return (
    <div className="grid h-[230px] grid-cols-3 gap-2.5">
      {cols.map((col) => (
        <div key={col.name} className="flex flex-col gap-2 rounded-2xl bg-[var(--wsurface-2)]/60 p-2">
          <h4 className="px-1 pt-0.5 text-[11px] font-bold tracking-wide text-[var(--wink-faint)] uppercase">{col.name}</h4>
          {col.deals.map((d) => (
            <div key={d.title} className="relative overflow-hidden rounded-lg bg-[var(--wsurface)] p-2.5 pl-3.5">
              <span className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${d.tone}`} />
              <b className="block text-[12px] text-[var(--wink)]">{d.title}</b>
              <span className="text-[11px] text-[var(--wink-faint)]">{d.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AutomationMock() {
  const nodes = [
    { title: "Trigger", body: "First message received", color: "bg-blue-500" },
    { title: "Send template", body: '"Welcome" · Marketing', color: "bg-primary" },
    { title: "Wait 1 day", body: "then check reply", color: "bg-amber-500" },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-0 py-2.5">
      {nodes.map((n, i) => (
        <div key={n.title} className="flex items-center">
          {i > 0 && (
            <div className="h-0.5 w-5 shrink-0 bg-[repeating-linear-gradient(90deg,var(--wglass-edge)_0_5px,transparent_5px_9px)]" />
          )}
          <div className="relative min-w-[132px] max-w-[160px] rounded-xl bg-[var(--wsurface)] p-2.5 pl-4 text-xs shadow-[0_6px_16px_-10px_var(--wshadow-2)]">
            <span className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${n.color}`} />
            <b className="block text-[var(--wink)]">{n.title}</b>
            <span className="text-[10.5px] text-[var(--wink-faint)]">{n.body}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <Eyebrow>Everything included</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>
          Built around how your team actually works
        </h2>
        <p className="mt-3.5 text-[17px] text-[var(--wink-soft)]">
          Every item below is a real, working part of WAGenie. Nothing here is a roadmap promise.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-[18px] bg-[var(--wsurface)] p-5.5 shadow-[0_1px_2px_var(--wshadow-1),0_12px_28px_-16px_var(--wshadow-2)] transition-transform duration-300 hover:-translate-y-1.5"
          >
            <div className="mb-3.5 grid h-9.5 w-9.5 place-items-center rounded-[11px] bg-primary/10 text-primary">
              <f.icon className="h-[19px] w-[19px]" />
            </div>
            <h4 className="text-[15.5px] font-bold text-[var(--wink)]">{f.title}</h4>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--wink-soft)]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HubDiagram() {
  return (
    <section id="hub" className="mx-auto max-w-[1180px] px-6 py-16">
      <HubDiagramCard />
    </section>
  );
}

function Comparison() {
  const bad = [
    "One phone, one person can reply",
    "Deals tracked in a spreadsheet, disconnected from the chat",
    "Broadcasts sent one by one, no idea who read them",
    "Following up depends on someone remembering",
  ];
  const good = [
    "Whole team, one shared inbox",
    "Pipeline lives right next to the conversation",
    "Segmented broadcasts with a delivery/read/reply funnel",
    "Automations follow up for you, every time",
  ];
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <Eyebrow>The overhaul</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>
          The old way vs. the WAGenie way
        </h2>
        <p className="mt-3.5 text-[17px] text-[var(--wink-soft)]">
          Stop losing what people asked for to memory, and stop losing messages to one overloaded phone.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[20px] bg-[var(--wsurface)] p-6 shadow-[0_1px_2px_var(--wshadow-1),0_12px_28px_-16px_var(--wshadow-2)]">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-500 to-orange-500" />
          <span className="text-[11px] font-bold tracking-wide text-orange-600 uppercase">Before WAGenie</span>
          <h4 className={`${DISPLAY_FONT} mt-1.5 text-[19px] font-bold text-[var(--wink)]`}>Scattered &amp; chaotic</h4>
          <div className="mt-4.5 flex flex-col gap-3.5">
            {bad.map((row) => (
              <div key={row} className="flex items-start gap-2.5 text-sm text-[var(--wink-soft)]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                {row}
              </div>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[20px] bg-[var(--wsurface)] p-6 shadow-[0_1px_2px_var(--wshadow-1),0_12px_28px_-16px_var(--wshadow-2)]">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary to-primary-2" />
          <span className="bg-gradient-to-r from-primary to-primary-2 bg-clip-text text-[11px] font-bold tracking-wide text-transparent uppercase">
            With WAGenie
          </span>
          <h4 className={`${DISPLAY_FONT} mt-1.5 text-[19px] font-bold text-[var(--wink)]`}>Unified &amp; automated</h4>
          <div className="mt-4.5 flex flex-col gap-3.5">
            {good.map((row, i) => (
              <div key={row} className="flex items-start gap-2.5 text-sm text-[var(--wink-soft)]">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: i < 2 ? "var(--primary)" : "var(--primary-2)" }}
                />
                {row}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Connect your WhatsApp Business number", body: "Bring your existing number in. There is no need to start from zero." },
    { n: "02", title: "Invite your team", body: "Everyone logs in separately; no more sharing one phone." },
    { n: "03", title: "Import contacts and start replying", body: "WAGenie starts drafting, tagging, and tracking from message one." },
  ];
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <Eyebrow>Getting started</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>Live in three steps</h2>
        <p className="mt-3.5 text-[17px] text-[var(--wink-soft)]">Deals, tags, and automations all grow from here as you use it.</p>
      </div>
      <div className="grid gap-4.5 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-[20px] bg-[var(--wsurface)] p-6.5 shadow-[0_1px_2px_var(--wshadow-1),0_12px_28px_-16px_var(--wshadow-2)]">
            <div
              className={`${DISPLAY_FONT} text-[34px] font-bold opacity-90`}
              style={{ color: "var(--primary-2)", WebkitTextStroke: "1.5px var(--primary)" }}
            >
              {s.n}
            </div>
            <h4 className="mt-2 text-[16.5px] font-bold text-[var(--wink)]">{s.title}</h4>
            <p className="mt-2 text-[13.5px] text-[var(--wink-soft)]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="mx-auto mb-12 max-w-xl text-center">
        <Eyebrow>Questions</Eyebrow>
        <h2 className={`${DISPLAY_FONT} text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>Frequently asked questions</h2>
      </div>
      <div className="mx-auto flex max-w-[720px] flex-col gap-2.5">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-5 py-4.5 backdrop-blur-xl"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[var(--wink)] marker:content-none">
              {f.q}
              <span className="shrink-0 text-xl text-[var(--wink-faint)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-[var(--wink-soft)]">{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="relative overflow-hidden rounded-[28px] border border-[var(--wglass-edge)] bg-[var(--wglass-fill)] px-10 py-16 text-center shadow-[0_16px_40px_-14px_var(--wshadow-2)] backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--primary) 12%, transparent), color-mix(in oklch, var(--primary-2) 12%, transparent))" }}
        />
        <div className="relative">
          <h2 className={`${DISPLAY_FONT} mx-auto max-w-xl text-3xl font-bold text-[var(--wink)] sm:text-4xl`}>
            Stop running your business out of a chat app.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "h-11 px-6 text-[15px]")}>
              Login
            </Link>
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 border-transparent bg-[var(--wsurface-2)] px-6 text-[15px] text-[var(--wink)] hover:bg-[var(--wsurface)]"
              )}
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto max-w-[1180px] px-6 py-14 text-[13.5px] text-[var(--wink-soft)]">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Image src="/brand/wagenie-logo.png" alt="WAGenie" width={172} height={31} className="mb-3 h-9 w-auto" />
          <p className="max-w-[240px]">One AI, one inbox, every WhatsApp message your business sends.</p>
        </div>
        <div>
          <h5 className="mb-3.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Contact</h5>
          <p className="mb-2 italic text-[var(--wink-faint)]">Business address (add later)</p>
          <p className="mb-2 italic text-[var(--wink-faint)]">Contact email (add later)</p>
          <p className="italic text-[var(--wink-faint)]">Phone, optional (add later)</p>
        </div>
        <div>
          <h5 className="mb-3.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Product</h5>
          <a href="#tour" className="mb-2 block hover:text-[var(--wink)]">Inbox</a>
          <a href="#tour" className="mb-2 block hover:text-[var(--wink)]">Pipeline</a>
          <a href="#tour" className="mb-2 block hover:text-[var(--wink)]">Automations</a>
          <a href="#features" className="block hover:text-[var(--wink)]">Features</a>
        </div>
        <div>
          <h5 className="mb-3.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Company</h5>
          <Link href="#" className="mb-2 block hover:text-[var(--wink)]">About</Link>
          <Link href="#" className="mb-2 block hover:text-[var(--wink)]">Contact</Link>
          <a href="#faq" className="block hover:text-[var(--wink)]">FAQ</a>
        </div>
        <div>
          <h5 className="mb-3.5 text-xs tracking-wide text-[var(--wink-faint)] uppercase">Get started</h5>
          <Link href="/login" className="mb-2 block hover:text-[var(--wink)]">Login</Link>
          <Link href="/signup" className="block hover:text-[var(--wink)]">Get Started</Link>
        </div>
      </div>
      <div className="mt-11 flex flex-wrap items-center justify-between gap-2.5 border-t border-[var(--wglass-edge)] pt-5.5">
        <span>© 2026 WAGenie. All rights reserved.</span>
        <span>
          <Link href="#" className="mr-4 italic hover:text-[var(--wink)]">Privacy (blank)</Link>
          <Link href="#" className="italic hover:text-[var(--wink)]">Terms (blank)</Link>
        </span>
      </div>
    </footer>
  );
}
