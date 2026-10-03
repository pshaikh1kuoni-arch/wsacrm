# WAGenie CRM: feature list

Last checked: 2 Oct 2026, against the code on `main` (commit 974aa9c).
Product name in the app: WAGenie. Code name: wacrm.

## How to use this file

Read this file first whenever you compare WAGenie with another product.
It says what is built, what is half built, what is only planned, and what
does not exist. Do not guess from the README. The README and CHANGELOG are
older than the code.

If you build or remove a feature, update this file in the same change.

Status words used below:

- BUILT: works in the code today.
- PARTIAL: some of it works. The note says what is missing.
- PLANNED: written in a plan file in `docs/`. No code yet.
- NOT BUILT: searched the code. Nothing found.

## At a glance

| Area | Status | Where it lives |
|---|---|---|
| Shared inbox | BUILT | `src/app/(dashboard)/inbox`, `src/components/inbox` |
| Contacts, tags, custom fields | BUILT | `src/app/(dashboard)/contacts`, `src/components/contacts` |
| Sales pipelines (Kanban deals) | BUILT | `src/app/(dashboard)/pipelines`, `src/components/pipelines` |
| Broadcasts | PARTIAL (no scheduling) | `src/app/(dashboard)/broadcasts`, `src/components/broadcasts` |
| Message templates | BUILT | `src/components/settings/template-manager.tsx` |
| Automations | BUILT | `src/app/(dashboard)/automations`, `src/lib/automations` |
| Flows (chatbot builder) | BUILT (marked Beta) | `src/app/(dashboard)/flows`, `src/lib/flows` |
| AI agents | BUILT | `src/app/(dashboard)/agents`, `src/lib/ai` |
| Dashboard | BUILT | `src/app/(dashboard)/dashboard` |
| Number health | BUILT | `src/app/(dashboard)/number-health` |
| Team and roles | BUILT | `src/lib/auth`, `src/components/settings/members-tab.tsx` |
| Public API, webhooks, MCP | BUILT | `src/app/api/v1`, `mcp-server/` |
| Catalogue and product messages | BUILT (basket automations not yet) | `src/components/settings/catalog-card.tsx`, `src/components/inbox/product-picker.tsx`, `src/lib/whatsapp/catalog*.ts` |
| Billing (the WAGenie subscription) | BUILT, needs migration 055 and Razorpay keys | `src/components/settings/billing-panel.tsx`, `src/lib/billing`, `src/lib/razorpay` |
| Public pages (pricing, terms, privacy, refunds, delivery, about, contact) | BUILT | `src/app/(site)`, `src/components/marketing/site-chrome.tsx` |
| Orders and payments | PLANNED | `docs/orders-payments-plan.md` |

## 1. Shared inbox

BUILT:

- One WhatsApp number shared by the whole team, with live updates.
- Conversation list with filters: all, unread, open, pending, closed.
- Filter by contact tag or by company. Search by name, phone or last message.
- Conversation status: open, pending, closed. Assign a chat to a team member.
- Start a chat with any phone number, even if it is not a saved contact.
- Send text, images, video, documents and voice notes.
- Voice notes are recorded in the browser (up to 5 minutes).
- Reply with a quote, react with an emoji, copy text. Customer reactions and
  quoted replies show up too.
- Send an approved template when the 24 hour window is closed.
- Quick replies: saved text or saved interactive messages, shared by the team.
- Interactive messages: reply buttons, lists and carousels.
- Message ticks: sending, sent, delivered, read, failed. A failed message
  shows Meta's reason.
- Customer messages received: text, image, video, document, audio, sticker,
  location, reactions, button taps and list taps.
- Received media is copied to our own storage so it does not expire (can be
  switched off).
- Contact panel inside the chat: details, tags, deals, notes. Add a deal
  from the chat.
- Send products from the plus menu: one product as a card, two to thirty as a
  list, or the whole catalogue as a View catalogue message. Search by name or
  ID, see the variant and the sale price, out of stock items cannot be picked
  (see section 5a).
- AI draft button, AI auto reply, take over and resume (see section 8).
- Unread badge in the sidebar. Browser notifications. Presence dot for
  team members who are online.
- Full screen mode for the inbox.

NOT BUILT:

- Internal notes inside a conversation. Notes exist on the contact only.
- Per conversation labels. Tags belong to the contact.
- Chat transfer rules, SLA timers, customer satisfaction survey.

## 2. Contacts

BUILT:

- Contact list with search, tag filter, paging and bulk delete.
- Add and edit a contact. Contact detail page with notes and deals.
- Tags with colours. Custom fields (you define the fields).
- CSV import. It skips duplicates and reports how many were imported and
  skipped. Tags can come in with the file.
- One contact per phone number. Duplicates are blocked and old duplicates
  were merged by a migration.
- Supports contacts that WhatsApp only identifies by username or BSUID.

NOT BUILT:

- Contact export to CSV.
- Saved segments or smart lists.
- A manual merge screen for two contacts.

## 3. Pipelines and deals

BUILT:

- Several pipelines, each with your own stages and colours.
- Kanban board. Drag a deal between stages. Keyboard dragging works too.
- Deal fields: title, value, currency, notes, expected close date, owner,
  status (open, won, lost). A deal can link to a contact and a conversation.
- Stage totals and a weighted pipeline value.
- Default currency for the account (Settings, Deals and currency).
- Automations can create deals.

NOT BUILT:

- Lead scoring and lost reason reports.
- A separate lead management module. Leads are handled with tags and deals.

## 4. Broadcasts

BUILT:

- Four step wizard: pick an approved template, pick the audience, fill the
  variables, review and send. A broadcast can be saved as a draft.
- Audience: all contacts, by tags (with exclude tags), by a custom field
  value, or a CSV upload with a sample file and counts.
- Each template variable can be fixed text, a contact field, or a custom field.
  The CSV upload carries phone and name only.
- Progress while sending. Sending retries in batches and can be resumed if it
  stops half way.
- Per person results: sent, delivered, read, replied, failed.
- Broadcast detail page with CSV export of results.
- Also available through the public API.

PARTIAL:

- Scheduling. The database has a `scheduled_at` column but there is no date
  picker, no scheduled status handling and no cron. Broadcasts send now or stay
  as a draft.

NOT BUILT:

- SMS fallback for messages that are not delivered.
- Link click tracking for URL buttons.
- A global opt out list for broadcasts. The STOP, UNSUBSCRIBE and QUIT
  words are caught only by the AI bot and flows (they stop follow ups).
- A/B tests and drip sequences.

## 5. Message templates

BUILT:

- Create, edit, submit to Meta, sync status, delete.
- Categories: marketing, utility, authentication.
- Header: none, text, image, video, document.
- Buttons: quick reply, URL, phone, copy code.
- Sample values for variables. Status updates and quality changes arrive
  from Meta by webhook.

NOT BUILT:

- Media card carousel templates for broadcasts. The plan file marks this out
  of scope for now. (The interactive carousel in chats is built.)
- Meta WhatsApp Flows forms (the in chat forms for bookings and data capture).

## 5a. Catalogue (Meta product catalogue)

BUILT:

- Settings, Catalogue (its own section and an Overview tile): shows which
  Meta catalogue is connected, how many items are copied, when it last
  synced, and a Sync now button (admin and owner).
- The CRM reads the catalogue from Meta and copies every item into its own
  table: name, price, sale price, size, colour, stock, picture and link. It
  only reads. It never changes the catalogue.
- A read only check of the shop icon and basket button for the number. Meta
  currently returns nothing for them, shown as "Not confirmed by Meta".
- Send products from the inbox (see section 1). A product list carries a
  snapshot of names and prices, so the chat keeps showing what was sent.
- Real catalogue facts the design handles: 326 items, 149 with a lower sale
  price, 74 product names shared by several variants, 9 out of stock.

- Receiving a customer's basket from the WhatsApp catalogue: the chat shows a
  basket card with the items, quantities, sale prices and a total worked out
  from our own catalogue prices. It flags unknown items, items out of stock,
  items with no price, a basket price that matches neither price, and a
  strange quantity. The team gets a notification (the assigned agent, or the
  owner, admins and agents if nobody is assigned).
- A basket never reaches the AI bot, keyword automations or the flow runner.
- A basket is not an order. It needs follow up by hand until the orders plan
  is built.

NOT BUILT:

- Turning a basket into an order, and the payment link (orders plan).
- A "Basket received" automation trigger, a "Send catalogue" automation step
  and flow node (step 4).
- Multi product broadcast templates and product carousels.
- Turning on the shop icon. Meta refused the API call (HTTP 500). Raised
  with Meta support.

## 6. Automations

BUILT:

- Visual builder with yes and no branches, a run log page and duplicate.
- 8 triggers: new message, first message, keyword match, new contact, chat
  assigned, tag added, time based, button or list reply.
- 13 steps: send text, send buttons, send list, send template, add tag,
  remove tag, assign chat (a specific person or round robin), update a
  contact field, create a deal, wait (minutes, hours, days), condition,
  call a webhook, close the chat.
- Conditions on contact field, tag, message text, or time of day.
- 4 starter templates: Welcome Message, Out of Office, Lead Qualifier,
  Follow-up Reminder.

NOT BUILT:

- A settings page for office hours. Out of Office works through a time of
  day condition.
- Order triggers (planned in `docs/orders-payments-plan.md`).

## 7. Flows (chatbot builder)

BUILT (shown with a Beta chip in the sidebar):

- Drag and drop canvas with auto layout. Draft, active and archived states.
- Triggers: keyword, first message, any message, manual.
- 14 node types: start, send message, send buttons, send list, send
  carousel, send media, send template, wait and follow up, collect input,
  condition, set tag, AI agent, hand off to a human, end.
- Wait and follow up has an AI written reminder inside the 24 hour window.
- Fallback rules: reprompt, hand off or ignore. Timeout sweep for old runs.
- Run history per flow. 3 starter templates: Welcome menu, FAQ bot, Lead
  capture. A check panel shows problems before you activate.

PLANNED:

- Describe a flow in plain words and let AI build it
  (`docs/ai-workflow-generator-plan.md`). Idea stage only.

## 8. AI agents

BUILT:

- You bring your own key. Providers: OpenAI, Anthropic, DeepSeek,
  OpenRouter. The key is stored encrypted.
- Business context and tone prompt.
- AI draft: one click writes a reply for the agent to edit.
- AI auto reply: limited per conversation and 30 per minute for the account.
  It hands off to a person when unsure. It leaves an internal summary note
  and can assign to a chosen agent.
- Catches "stop messaging me" in any wording and stops follow ups.
- Knowledge base: add FAQs and policies. Search uses full text, and also
  meaning based search when an embeddings key is added.
- Playground to test the agent before customers see it.
- Usage tab with token counts by day, mode and model.
- AI badge on bot messages. Take over and Resume buttons in the chat.
- AI agent node inside Flows.

NOT BUILT:

- AI tool calling (look up an order, take an order). Planned for the orders
  work.
- Voice or image understanding by AI.

## 9. Dashboard and reports

BUILT:

- Cards: active conversations, new contacts today, open deals value,
  messages sent today (each compared with yesterday).
- Charts: conversations over time (in and out), pipeline value by stage,
  response time by day of week. Activity feed. Quick actions.

NOT BUILT:

- Per agent performance report.
- Campaign analytics beyond the broadcast detail page.
- Report export.

## 10. Number health (owner view)

BUILT:

- Quality rating, messaging limit tier and display name status for the
  connected number, with change history.
- Daily message volume chart.
- WhatsApp usage and cost from Meta.
- Progress toward Meta Tech Partner targets (owner only).
- Refresh button for admins.

## 11. Team, roles and security

BUILT:

- Roles: owner, admin, agent, viewer. Buttons are greyed out for roles
  that cannot use them.
- Invite by link (no email sent). Choose role and expiry. Change roles,
  remove people, transfer ownership.
- Profile with photo, password change, sign out of all devices.
- Tokens and keys encrypted (AES-256-GCM). Row level security on all tables.
  Webhook signature check, rate limits, content security policy.

NOT BUILT:

- Audit log screen.
- Two factor login inside the app.

## 12. WhatsApp connection

BUILT:

- Connect by Phone Number ID, WABA ID, access token, verify token and PIN.
- Test connection, number registration check, webhook subscription check.
- Works with several WABAs across accounts on one deployment
  (`docs/multi-waba.md`).

NOT BUILT:

- Embedded Signup (connect with a Facebook login button). Listed as later in
  `docs/meta-tech-partner-plan.md`.
- More than one WhatsApp number in one account. The database allows one
  connection per account.

## 13. Developer tools

BUILT:

- Public REST API `/api/v1` with scoped, revocable keys, rate limits and
  paging. Send messages, read and write contacts, read conversations,
  launch broadcasts, manage webhooks.
- Outbound signed webhooks: message received, message status updated,
  conversation created. Failing endpoints switch off by themselves.
- MCP server with 10 tools (read tools always on, write and broadcast tools
  switched on by choice): list and get contacts, list and get
  conversations, list messages, create and update contact, send message,
  send broadcast, get broadcast.

NOT BUILT:

- Ready made connectors for Shopify, Zoho, LeadSquared, Razorpay or
  Zapier. Everything goes through the API and webhooks.

## 14. Look, language and hosting

BUILT:

- Light and dark mode. 5 colour themes.
- Languages: English, Spanish, Korean, Portuguese.
- Works on phone screens (responsive). No installable app or PWA.
- In app notifications page and browser notifications.
- Marketing landing page at the root address, and public pages for Pricing, Terms and Conditions, Privacy Policy, Cancellation and Refunds, Delivery, About and Contact. The business details shown on them live in `src/lib/site.ts`.
- Settings, Billing: the workspace Owner pays WAGenie 2,500 rupees for one month with Razorpay Checkout. The server checks the signature and asks Razorpay for the payment before it adds a month. Admins and the Owner see the receipts. Needs migration 055 and `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the environment (Test mode keys show a Test mode notice). Each payment adds one month; there is no automatic renewal yet.
- Runs on Vercel, Hostinger, Docker. More than 1,000 automated tests.

NOT BUILT:

- Hindi or other Indian languages in the app.
- A credits wallet, several plans, and automatic renewal. Billing today is one plan paid one month at a time (see the BUILT list above).

## 15. Planned work

1. Orders, payments and support (`docs/orders-payments-plan.md`, version 1.2).
   Razorpay payment links, order records, order status questions answered by
   AI, Google Sheet product sync, Orders API. Nothing is built yet.
   Also adds: capture of ad click details (Click to WhatsApp), Buy now
   buttons, and the order triggers in Automations.
2. Meta Tech Provider and Tech Partner steps
   (`docs/meta-tech-partner-plan.md`). The Number health page is the first
   part and is done.
3. AI workflow generator (`docs/ai-workflow-generator-plan.md`). Idea only.
4. Carousel messages (`docs/carousel-messages-plan.md`). Built and pushed.
   The Supabase migration 048 and a live click test were still open when the
   plan was last updated.

5. Catalogue and basket (`docs/catalog-cart-plan.md`, version 1.1). Steps 1
   to 3 are built: the catalogue copy, sending products and receiving a
   basket. Next are the automation pieces (step 4). Turning a
   basket into an order, and the payment link, belong to the orders plan.

## 16. Earlier competitor look

`docs/carousel-messages-plan.md` records a feature by feature look at a
competitor called Levin AI. Carousel was built from it. These were noted and
left for later: fix for round robin assignment, Click to WhatsApp ad capture,
drip campaigns, office hours, QR generator, contact export.
