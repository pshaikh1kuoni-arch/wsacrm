# Landing Page — Content & Sales Plan (v1 write-up)

This is the write-up only — no page has been built yet. Once you sign off on the
narrative and structure below, the next step is turning it into real code
(reusing the app's own design system: floating cards, the two-stop gradient
accent, light/dark parity).

## 0. What I looked at

Three of your own sites, purely for style/structure reference (not to copy
feature-for-feature):

- **mjaidz.in** — floating pill nav, numbered "how it works" stepper, an
  honest "Contact for Pricing" card instead of fake numbers, and a footer
  where address/email/phone are visibly marked optional. Also confirmed:
  B2B tools like this skip public self-serve signup entirely — it's
  "Login" for existing users and "Request Access / Email us" for new ones.
- **jsmnexus.in** — bold serif+script headline mix, a purple→cyan gradient
  CTA button (same two-stop-gradient idea we already built into wacrm's
  own theme system).
- **aishopix.com** — the closest in spirit (WhatsApp-first business tool).
  Strongest idea to borrow: the hero doesn't use a stock photo, it shows
  the *actual product* — a live WhatsApp conversation mockup. Also strong:
  outcome-framed benefit cards ("Explore Benefit →"), a before/after
  comparison block, and a real FAQ.

wacrm has an advantage none of these three fully lean into: the product
UI itself is already redesigned and good-looking. The landing page should
show real (or realistic) screenshots of *our own* Inbox, Dashboard, and
Pipeline board — not illustrations — so the marketing site and the actual
product feel like one brand from the first click.

## 0b. Deep-dive: aishopix.com's motion, glass, and diagram (per your request)

I went back and actually recorded the page (screenshots + a short video,
frame-by-frame) to see the animations properly rather than guessing from
a static look. Three concrete things worth borrowing, with the exact
technique behind each:

**1. The floating glass nav bar.** I read its real computed CSS:
`backdrop-filter: blur(20px) saturate(2) brightness(1.01)`, a fully
pill-shaped radius, a hairline `1px solid rgba(255,255,255,0.55)` border,
and a *layered* box-shadow — one soft purple-tinted outer shadow for lift,
plus three inset shadows (a bright inset top edge, a faint tinted inset
bottom edge, and a 0.5px inset rim) that together fake a beveled glass
edge. This is more than "add backdrop-blur" — it's the shadow layering
that sells the glass. We'll build this as a reusable `.glass-panel`
utility in `globals.css`, with a light-mode tint (soft white) and a
dark-mode tint (soft near-black), so it works with our existing
`data-mode` system instead of being hardcoded to one theme.

**2. The soft colorful background.** The whole page sits on a handful of
large (500–650px), heavily blurred (`blur-[100px]` to `blur-[120px]`),
low-opacity (~20–28%) circles in purple/cyan/violet/fuchsia, positioned
absolutely around the page (`ambient-orb` in their own class name) —
sitting *behind* the glass panels. This is what makes the glass panels
read as "frosted" rather than just "blurry." We'll do the same, but
built from wacrm's own gradient accent colors (`--primary`/`--primary-2`
per the active theme) so it re-tints automatically with whichever accent
the visitor's browser defaults to, instead of being hardcoded purple.
This effect is landing-page-only — the actual product app stays exactly
as flat/opaque as it is today; this is a marketing-page flourish, not a
Phase-4-style app-wide change.

**3. The hub-and-spoke diagram** (their "Feed 1 Catalog, Sell Anywhere"
section). Structure: one large solid-gradient circle in the center, 8
smaller white circles arranged around it in a ring, each joined to the
center by a dashed line. The animation isn't a click-triggered one-off —
it's a continuous, gentle **radial pulse**: every couple of seconds a
soft glow "breathes" outward from the center hub through the whole ring
(the frames I captured show the entire diagram dim slightly as the pulse
sweeps past, like a heartbeat), plus small pin-prick dots sitting on each
dashed line that drift along it. That's the "blinks like blood" effect —
it's a looping ambient animation, not something you have to click to see.

We can recreate the *shape* of this (a hub-and-spoke diagram is a great
fit for "one AI, many channels") without their content — the center hub
becomes **WAGenie AI**, and the spokes become wacrm's real categories:
**Marketing** (promotional templates), **Utility** (order/status
updates), **Authentication** (OTP), **Inbox**, **Pipeline**,
**Automations**, **Broadcasts** — reusing WAGenie's own real capabilities,
not invented ones. Technique: pure CSS, no canvas/SVG library needed — a
radial `box-shadow`/`radial-gradient` pulse animated on `opacity`/`scale`
at the center, and a small dot per spoke animated along a fixed-angle
`translate` path, staggered per spoke so they don't all pulse in unison.
Same `prefers-reduced-motion` guard from the motion-system phase applies
here too — the pulse and drifting dots turn off, the diagram still reads
fine fully static.

## 1. Positioning — what we're actually selling

**One line:** *A WhatsApp inbox your whole team can work from, with the
CRM (contacts, deals, automations) built in — not bolted on.*

Who it's for: small-to-mid businesses currently running sales/support
over a personal WhatsApp number or a shared phone, drowning in chats with
no record of who's talking to whom, no pipeline, and no way to bring a
second person onto the account without literally sharing a phone.

The sales hook is **consolidation**, not any single flashy feature:
*"Stop stitching together WhatsApp Business + a spreadsheet + a separate
CRM. It's one login, one inbox, one pipeline."*

What we will **not** claim (things AiShopix has that wacrm does not —
important not to overclaim): no catalog/storefront, no payment
collection, no shipping/logistics integration, no Instagram/Google
Merchant sync. This is a CRM + inbox + automation platform, not a
commerce OS. Copy stays honest to what's actually shippable today.

## 2. Page structure (top → bottom)

| # | Section | Purpose |
|---|---|---|
| 1 | Nav | Logo, a few anchor links, **Login** (real), a disabled-look "Get Started" (placeholder) |
| 2 | Hero | Promise + real product screenshot (Inbox) |
| 3 | Logo/trust strip | Light social proof placeholder |
| 4 | Product tour (3 blocks) | Inbox → Pipeline → Automations, each with a real screenshot |
| 5 | Feature grid | The full capability list, scannable |
| 6 | **WAGenie AI hub diagram** | Center hub = WAGenie AI, spokes = Marketing / Utility / Authentication / Inbox / Pipeline / Automations / Broadcasts — glass panel, ambient radial pulse (see §0b) |
| 7 | "Old way vs. wacrm way" | Before/after, the consolidation pitch made concrete |
| 8 | How it works | 3-step onboarding |
| 9 | FAQ | Objection handling |
| 10 | Final CTA band | Login + placeholder "Get Started" |
| 11 | Footer | Placeholder contact fields, legal links (blank pages for now) |

## 3. Section-by-section copy draft

### Nav
`wacrm` (or final product name) · Product · Features · FAQ · **Login** ·
`Get Started` (visually a button, not yet wired to anything)

### 2. Hero

**Eyebrow:** ONE INBOX. ONE PIPELINE. ONE TEAM.

**Headline:**
> Turn WhatsApp into your team's CRM, not just a chat app.

**Subheadline:**
> Every conversation, contact, deal, and follow-up in one shared inbox —
> so nothing depends on one phone or one person's memory.

**CTAs:** `Login` (primary, real) · `See how it works ↓` (secondary,
scrolls down — no backend needed)

**Visual:** the actual Inbox screenshot (3-pane, a real-looking
conversation, the gradient-accent active nav) — this alone communicates
"real, working, well-built product" better than any adjective.

### 3. Trust strip
Placeholder row: `Built for teams who live in WhatsApp` + 3–4 blank
logo-shaped placeholders (client logos go here later — leave empty/gray
boxes, not fake names).

### 4. Product tour — three real screenshots, three promises

1. **Shared Inbox** — "Every teammate sees the same conversations, the
   same contact history, the same status — no more 'who replied to
   this?'" *(screenshot: Inbox)*
2. **Pipeline that lives next to the chat** — "Turn a conversation into a
   deal without leaving WhatsApp. Track stage, value, and who owns it."
   *(screenshot: Pipeline board)*
3. **Automations that actually fire** — "Auto-tag, auto-assign, auto-reply
   to the first message, or wait-and-follow-up — built visually, no code."
   *(screenshot: Automation builder / Flow canvas)*

### 5. Feature grid (icon + title + one line — grounded in what's real)

- **Unified Inbox** — Multi-agent shared inbox with read receipts, session
  timers, quick replies and saved templates.
- **Contacts** — Custom fields, tags, company grouping, CSV import.
- **Pipelines** — Kanban deal boards with per-stage analytics.
- **Broadcasts** — Segmented campaigns (by tag, custom field, or CSV list)
  with delivery/read/reply funnel tracking.
- **Automations** — Trigger-based workflows: keyword or first-message
  triggers, tagging, assignment, wait-steps, branching conditions.
- **AI-assisted replies** — Draft suggestions inside the composer, backed
  by your own knowledge base.
- **Team & roles** — Bring your whole team onto one WhatsApp number with
  presence and assignment, not one shared phone.
- **Built to match your brand** — Light/dark, 5 accent themes, out of the
  box.

### 6. "Old way vs. the wacrm way"

| Before | With wacrm |
|---|---|
| One phone, one person can reply | Whole team, one shared inbox |
| Deals tracked in a spreadsheet, disconnected from the chat | Pipeline lives next to the conversation |
| Broadcasts sent one by one, no idea who read them | Segmented broadcasts with a delivery/read/reply funnel |
| Follow-ups depend on someone remembering | Automations follow up for you |

### 7. How it works
`01` Connect your WhatsApp Business number → `02` Invite your team →
`03` Import contacts and start replying — everything after that (deals,
tags, automations) grows as you use it.

### 8. FAQ (placeholder answers to refine later, but real questions)
- Do I need the official WhatsApp Business API?
- Can more than one person reply from the same number?
- What happens to my existing contacts/chat history?
- Is there a free trial?
- Is my data private to my business only?

### 9. Final CTA band
> **Stop running your business out of a chat app.**
> `Login` · `Get Started` (placeholder)

### 10. Footer
- Logo + one-line tagline
- **Contact** — business address *(blank)*, contact email *(blank)*,
  phone *(blank, marked optional — matches your own mjaidz.in pattern)*
- **Company** — About, Contact, Terms *(blank page)*, Privacy *(blank
  page)*
- Copyright line

## 4. What's real vs. placeholder (per your instruction)

- **Login** → wired to the real `/login` route that already exists in
  the app. This is the only functional entry point for v1.
- **"Get Started" / "Subscribe"** → renders as a real button, but does
  nothing yet (or opens an empty modal) — the actual signup/subscription
  flow (name, address, mobile number, plan selection) is a later phase,
  once you decide the actual sign-up model (self-serve vs. invite-only,
  like mjaidz.in does).
- **Terms / Privacy / Cancellation** → footer links exist, point to
  blank placeholder pages, not 404s.
- **Trust strip logos, testimonials** → left empty/placeholder, not
  fabricated names or fake quotes.

## 5. One technical note for later (not a decision needed now)

Right now `/` immediately redirects to `/dashboard` — there's no public
page at all yet. Building this means `/` becomes the new marketing page,
and the "already logged in" redirect-to-dashboard behavior moves to
happen only when someone actually clicks Login/Get Started while already
authenticated. Flagging this now so it's not a surprise later; nothing
to decide yet.

## 6. Decisions locked in

1. **Product name: WAGenie** — WhatsApp + Genie (AI grants your WhatsApp
   wishes: generate the marketing template, send the utility update, fire
   the auth OTP, on command). Every `wacrm`-as-brand-name reference above
   becomes **WAGenie**.
2. Trust strip: fully empty for v1 — no logos, no fake testimonials.
3. One long scrolling page for v1, not split routes.

(Domain/trademark availability for "WAGenie" hasn't been verified by me —
worth a quick check before this goes fully public.)
