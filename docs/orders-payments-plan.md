# Orders, payments and support: locked plan

Version 1.5, 4 Oct 2026. Locked for owner approval. Phase R is built and live. Phases 0 to 4 are not built yet.
Changes from 1.4: the webhook is confirmed as a required part of the design, with a one time setup per business and a status light in Settings, Payments (decision 18). The platform fee gets a webhook safety net and auto renew in a new Phase R2. Both payment lanes stay in Test mode until launch. The body now matches decisions 16 and 17: products come from the catalogue, and the CSV and Google Sheet product import is dropped. New migrations start at 058. The Phase R text matches what was built. A new section 0 explains where we are today.
Changes from 1.3: decision 17 added (two payment lanes, each business uses its own Razorpay keys and its own webhook secret), and the webhook function is renamed `pay-webhook`. Changes from 1.2: Phase R (Razorpay review pack) added before Phase 1; the catalogue work (migrations 052 to 054, table `catalog_items`) is now the product source, so new migrations start at 055. Changes from 1.0: open items 1, 2, 3, 4 and 9 settled, partial payments off, Razorpay events and Phase 0 steps updated, a Check payment status button added to Phase 1, a 5 second webhook rule, Appendix A button address, Appendix C (Meta checklist) and Appendix D (Razorpay checklist) added.
Mockup, 12 screens: 9 for orders and payments and 3 for Phase R (private link): https://claude.ai/artifact/35aFUKvLMa4kojACWAA4cF
This file: `docs/orders-payments-plan.md`

## 0. Read this first: where we are today

### 0a. What is built and working

Built and pushed to main on 3 Oct 2026 (Phase R, the Razorpay review pack):
1. Seven public pages on https://wagenie.vercel.app: Pricing, Terms and Conditions, Privacy Policy, Cancellation and Refunds, Delivery, About and Contact. They carry your contact details. The old "add later" placeholders are gone.
2. Settings, Billing. The workspace Owner presses Pay ₹2,500 and Razorpay Checkout opens. The server checks the payment with Razorpay before it adds one month. Each payment gets a receipt number such as WAG-000001, and the page shows the payment history. Only the Owner can pay. Today the paid status is shown on the page, but nothing blocks access when a month ends.
3. A Razorpay library in the code: create an order, check a signature, fetch a payment. Phase 1 reuses it for payment links.
4. The database table `billing_payments` (migration 055). Applied in your live Supabase on 3 Oct.
5. Razorpay Test keys are in Vercel. The live check on 3 Oct passed: the Pay button created a test order and the Razorpay window opened. In Test mode a UPI QR shows "invalid QR" on a phone. That is expected, because a real UPI app cannot read a test QR. The test card and the UPI ID success@razorpay do work.
6. A separate Demo Workspace with fake contacts, chats and deals, and a test login for the Razorpay reviewer. The login email is razorpay.review@example.com. The password is not written in this file.
7. Razorpay approved the website review (reported by you on 4 Oct 2026).

Built earlier by you, outside this plan: the catalogue and basket feature (see `docs/catalog-cart-plan.md`, migrations 052 to 057, table `catalog_items`). Orders use it as the product source (decision 16).

### 0b. What is not built yet

1. Everything for chat payments (Lane B): the Orders pages, Settings, Payments, payment links, the `pay-webhook` function, the order automations and the inbox changes. That is Phases 0 to 4.
2. For the platform fee (Lane A): the webhook safety net, auto renew, GST ready receipts and Live keys. That is Phase R2.

### 0c. What changed since the PDF you have (version 1.0)

1. Two payment lanes that never merge (decision 17). The platform fee goes to your own Razorpay account. Chat payments go to each business's own Razorpay account.
2. The webhook is required. Each business sets it up once, and Settings, Payments shows a status light (decision 18).
3. Each business has its own webhook address and its own webhook secret. The function is called `pay-webhook`, not `razorpay-webhook`.
4. Both lanes stay in Test mode until launch. Live keys come at launch.
5. The Razorpay events are now `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.failed` and `refund.processed`. Version 1.0 also listed `payment.captured` and `order.paid`. They are dropped because they fire for a business's own website payments too.
6. Payment links have partial payments switched off.
7. The webhook must answer within 5 seconds. Razorpay retries for 24 hours and then switches a failing webhook off.
8. A new Check payment status button on pending orders, as a backup only.
9. Products come from the catalogue in `catalog_items` (decision 16). The CSV and Google Sheet product import is dropped. The Google Sheet stays for shipments (Phase 3).
10. Open items 1, 2, 3, 4 and 9 are answered. The code uses Graph API v21.0 and Meta's docs use v23.0, so I raise the version early in Phase 1.
11. New Phase R (built) and Phase R2 (later).
12. New Appendix C (Meta checklist) and Appendix D (Razorpay checklist).
13. New migrations start at 058, because 055 to 057 are used.
14. Roles, costs, the customer journey and the money rules are unchanged, except for the small additions marked in sections 5 and 12.

### 0d. What I need you to confirm

1. Decisions 17 and 18: two lanes, and the webhook as a required part with a status light.
2. Decision 16: products come from the catalogue, and the CSV and Google Sheet product import is dropped.
3. Both lanes stay in Test mode until launch.
4. Phase R2 as the next step for the platform fee, and the three decisions in it.
5. The Phase R leftovers: the GST wording ("plus GST as applicable"), the refund terms, a phone number for Contact Us, that the business name on Razorpay matches the pages, and whether to use your own domain instead of wagenie.vercel.app.
6. That I may add the webhook status light and the catalogue product picker to the mockup next, before any Phase 1 code.

## 1. What we are building

One system does three jobs:
1. Sell. Ads and offer templates bring customers into WhatsApp. They tap Buy now or tell us what they want.
2. Collect. They pay once with a Razorpay payment link. We confirm the payment for real, create an order number and record exactly what they bought.
3. Care. The customer gets "order received" and an offer. Later they can ask "where is my order" at any time. The system looks up the shipping details you keep in the CRM or in a Google Sheet, and the AI replies.

Your website, and later other websites, can connect through an API, within limits.

## 2. The customer journey

1. The customer arrives in one of three ways. From an ad: the first message carries the ad ID and click ID, and we save them. From an offer template: they tap Buy now, a quick reply button. From your website: the cart goes to the Orders API (Phase 3).
2. We learn what they want. From the Buy now product, a product code, a chat list, or the AI reading their text and repeating it back ("2 mugs, ₹598, correct?").
3. We create the order with an order number, items, source and the status awaiting payment.
4. The system sends one message with the order summary and the payment link.
5. The customer pays on Razorpay.
6. Razorpay calls our `pay-webhook` function in Supabase, at the address that belongs to that business. It checks the signature, saves the event once, and marks the payment and order Paid in one safe step, only if the amount matches.
7. The app adds the Paid tag. Your automations send "order received", wait 5 minutes, then send the offer.
8. Shipping details are added on the Orders page or in the Shipments sheet.
9. The customer asks "where is my order". The AI looks up their order and replies.
10. Refunds, cancels and address changes go to a human.
11. A scheduled job re-checks pending payments and expires old unpaid orders (Phase 3).
12. A customer coming back from the website lands in WhatsApp through a link with the order number typed in (Phase 3).

## 3. Who does what

You:
- Own the accounts: Razorpay, Meta, Supabase and your website.
- Create keys and secrets and put them straight into the app Settings or Supabase. Never paste a secret in chat.
- Create and submit templates in Meta, and run the ads.
- Make the decisions marked "Decision" in each phase.
- Test each phase in Test mode first. The ₹1 Live tests are repeated at launch. Then sign off.

Me:
- Write all the code, migrations and tests.
- Read the Next.js docs in node_modules before writing route code, as AGENTS.md requires.
- Show a mockup first for any new screen that is not in the approved mockup.
- Give you exact steps, commands and wording for every setup task.
- Read the logs and error text you paste, and fix problems.
- Update this file whenever a decision changes.
- Push finished work to main (your rule for the testing phase). Payment code does nothing until Razorpay keys are saved in Settings, so main stays safe.

## 4. Decisions already made

1. Razorpay is the payment provider for both lanes (decision 17). For chat payments, each business uses its own approved Razorpay account. If that account also serves the business's own e-commerce website, the website must keep working and must never appear in the CRM by accident.
2. The first payment way is a Razorpay payment link. The Pay button inside WhatsApp and the UPI QR come later.
3. The Razorpay webhook is received by a Supabase edge function. The app does the messaging and tagging.
4. Roles stay Owner, Admin, Agent and Viewer. Agent is not renamed. Role rights are fixed in `src/lib/auth/roles.ts` first. Per business switches for Agent come in Phase 3.
5. Replaced by decision 16. Products come from the catalogue in `catalog_items`.
6. LangChain is not used. AI tools use the model provider's own tool calling.
7. The Level 3 operator only layer (reading an outside database through Supabase Wrappers) is skipped for now.
8. When the customer starts the chat (taps Buy now, replies to an ad, or types a product code), the 24 hour window is open. The system sends the order summary, the payment link and the confirmations as free-form messages, filled in from the order record. A template is used only when we start the conversation or the window is closed. See section 6.
9. The Buy now button on the offer template is a quick reply button, so the tap opens the 24 hour window. The order summary follows the agreed format: order number, product code and name, quantity and price, total, payment link. The link goes as plain text first.
10. Order messages run through your Automations. We add the triggers Order created, Payment received and Payment failed, and pass the order details as variables. If a default automation is missing or switched off, the system sends a built-in default message, so a payment message is never silently lost.
11. By default we do not push shipped and delivered messages. The customer asks, and the AI answers. A shipped template is an option (Phase 3).
12. When a customer asks about an order, the system finds that customer's orders by their WhatsApp number and replies using only facts from the order record or the Shipments sheet: status, courier, tracking number, tracking link and an expected delivery text that you type. The reply mode is AI. The AI states only the facts it was given. If data is missing, or the customer asks for a refund, cancel or address change, it hands over to an agent. If the AI call fails, the existing handoff message goes out and an agent is alerted. A custom message mode stays available as a switch.
13. Shipping details are kept in both places: on the Orders page and in a Shipments tab of your Google Sheet. The sync applies a sheet value only when that value changed in the sheet since the last sync. So a change made on the Orders page is not overwritten by an old sheet value. If both changed since the last sync, the sheet wins and the timeline notes it.
14. Stock tracking and writing orders back to the Google Sheet is optional, and sits in Phase 4 (section 13).
15. WAGenie is a SaaS. It has two separate Razorpay uses. The first is WAGenie's own billing: the ₹2,500 monthly subscription, paid by each workspace Owner, using platform keys in the Vercel environment (Phase R). The second is each business taking payments from its own customers, using keys saved per workspace in Settings, Payments (Phase 1). Both use the same Razorpay library.
16. The product source is the Meta catalogue copy in `catalog_items` (WooCommerce stays the master), not a separate CSV or Google Sheet products table. The CSV and Google Sheet product sources in decision 5 are dropped unless a business has no catalogue. The Google Sheet stays for shipping details (Phase 3). The product parts of the Phase 3 API are reviewed again when Phase 3 starts.
17. Two payment lanes, settled 3 Oct 2026. They never merge.
    - Lane A, the platform fee: the business Owner pays WAGenie. It uses the platform Razorpay keys in Vercel, the table `billing_payments` and Settings, Billing. Razorpay orders carry the note `purpose: wagenie_subscription`. It stays in Test mode until launch. Live keys are swapped in at deployment, when subscriptions start. A webhook safety net for this lane (so a payment is not lost if the Owner closes the tab) is added together with auto renew.
    - Lane B, chat payments: a business's customer pays that business. Each business adds its own Razorpay keys in Settings, Payments, so the money goes straight to that business's own account. WAGenie never holds it. These Razorpay orders and links carry our own order note and the order number. It also runs in Test mode until launch.
    - Each business has its own webhook secret and its own webhook address, because each business has its own Razorpay account. The CRM makes the secret and a random token for the address, and shows them once with copy buttons. The owner pastes both into their own Razorpay. The function finds the business from the token in the address, reads that business's stored secret and checks the signature with it. The secret is stored encrypted in the database, not in Supabase secrets.
    - Any event that is not ours (for example a business's own website payments) gets a 200 and is ignored.
    - The function is named `pay-webhook`, not `razorpay-webhook`. Razorpay refuses addresses that use `razorpay` as a domain. A function name is not a domain, but the safer name costs nothing because nothing is deployed yet.
18. The webhook is required, settled 4 Oct 2026. Chat payments do not update the CRM without it, so it is part of the design and not an option.
    - Each business sets it up once, in about five minutes. Open Settings, Payments, copy the webhook address and the webhook secret, paste both into their own Razorpay under Webhooks, and save.
    - Settings, Payments shows a status light for the webhook. "Not connected yet" until the first valid event arrives. "Connected", with the time of the last event, after that. "Problem" if events arrive with a wrong secret. This needs a mockup before it is built (section 8).
    - The Check payment status button on pending orders stays as a backup only. It asks Razorpay's server directly.
    - Lane A (the platform fee) works without a webhook today, because Razorpay Checkout returns the result to the page. A webhook safety net is added for it in Phase R2, so a paid month is not lost if the Owner closes the tab. For auto renew the webhook is required, because renewals happen when nobody has the page open.

## 5. Rules that never change (money)

1. Only a verified Razorpay event marks an order Paid. No API call and no website claim can do it. The Check payment status button counts as verified, because it asks Razorpay's server directly.
2. An order is Paid only if the amount Razorpay received equals the order total. If not, it goes to "needs review".
3. Every Razorpay event is saved once by its ID. A repeat changes nothing and sends no second message.
4. The webhook acts only on payments that carry our own note. It answers OK to all others and ignores them.
5. A payment link has a fixed amount. To change the amount, cancel the link and send a new one on the same order. Partial payments are switched off on every link.
6. Card details are never stored.
7. Razorpay keys and webhook secrets are stored encrypted. Only the Owner can change the keys.
8. Marketing messages respect the existing opt out.
9. The webhook answers within 5 seconds with a 2xx, and does the rest in the background. Razorpay retries for 24 hours and then switches a failing webhook off.
10. The two lanes never share keys. WAGenie's own keys are never used for a business's customers, and a business's keys are never used for the platform fee.

## 6. WhatsApp message costs and scenarios

### 6a. Costs from 1 Oct 2026

Checked on 2 Oct 2026 from news and provider announcements. Meta's own pricing page, as I could read it, did not show the change yet. Confirm the numbers in your WhatsApp Manager billing and rate card before relying on them.

| Message type | When it can be sent | Cost in India, before 18% GST |
|---|---|---|
| Free-form message (service message) | Inside the 24 hour window after the customer wrote | First 1,000 a month per phone number are free. After that ₹0.115 each |
| Utility template | Any time | ₹0.115 each. No free allowance, even inside the window |
| Marketing template | Any time | About ₹0.8631 each |
| Any message in a Click to WhatsApp ad window | 72 hours after the ad click | Free |
| Customer messages to you | Always | Free |

What this means:
1. After the free 1,000, a free-form message costs the same as a utility template. Free-form is cheaper only inside the free 1,000 a month.
2. A marketing template costs about 7.5 times a utility template. Use marketing templates for broadcasts only.
3. Every message you send in the chat counts, including AI replies.
4. A free-form message can only go inside the 24 hour window. Outside it, only a template works.
5. Our order flow stays inside the window:
   1. A marketing offer template with a Buy now button goes to your contacts. You pay for this in any case. The button must be a quick reply button. A link button does not open the window.
   2. The customer taps Buy now. That is a message to you, and it opens the window.
   3. The system sends the order summary and the payment link as one free-form message.
   4. "Order received" goes as a free-form message.
   5. The offer goes as a free-form message.
6. Example for 1,000 orders a month on one number, 3 messages each, not counting AI chat replies:
   - Free-form: 3,000 messages. 1,000 free, 2,000 at ₹0.115 is ₹230 before GST, about ₹271 with GST.
   - As templates (payment request and order received as utility, offer as marketing): ₹1,093 before GST, about ₹1,290 with GST.
7. Add a payment method to the WhatsApp Business Account. Sources disagree on whether service messages stop without one. Check it in WhatsApp Manager.

### 6b. Scenarios and the message each one needs

| # | Scenario | 24 hour window | Message type | Cost before GST |
|---|---|---|---|---|
| 1 | Customer taps Buy now, replies to an ad, or types a product code | Open | Free-form order summary with the payment link | Free within the 1,000, then ₹0.115 |
| 2 | Customer pays | Open, if the link expires within 24 hours | Free-form "order received" | Same as 1 |
| 3 | Offer after payment | Open | Free-form | Same as 1 |
| 4 | Customer asks "where is my order" | Open | Free-form reply from the AI or an agent | Same as 1 |
| 5 | An agent asks for payment from a customer who has not written in 24 hours | Closed | `payment_request` template | ₹0.115 |
| 6 | Reminder to an unpaid customer, window closed | Closed | `payment_request` template | ₹0.115 |
| 7 | Reminder to an unpaid customer, window open | Open | Free-form | Same as 1 |
| 8 | Order placed and paid on the website, customer never chatted | Closed | `order_received` template, or send nothing, or show a return link into WhatsApp on the website | ₹0.115 or free |
| 9 | New offer to many contacts | Closed | Marketing template with a Buy now button | About ₹0.8631 |

Notes:
1. The system builds each message from the order record, so it always shows the right order number, product code, product name, quantity, price and total.
2. Example of the free-form message in scenario 1:
   > Your order ORD-000129 is ready.
   > Product: Ceramic Mug, white 350 ml (MUG1)
   > Quantity: 2 x ₹299
   > Total: ₹598
   > Pay within 30 minutes: (payment link)
3. You edit the wording in Automations. The system fills in the details through variables such as `{{vars.order_number}}`.
4. Today Automations understand only `{{message.text}}` and `{{vars.name}}`. The order system will pass the order details in `vars` when it fires the new order triggers, so the variable filling code needs no change. The automation builder shows the list of order variables:
   - `{{vars.order_number}}`, `{{vars.customer_name}}`
   - `{{vars.product_code}}`, `{{vars.product_name}}`, `{{vars.quantity}}`, `{{vars.unit_price}}`
   - `{{vars.items}}` (all lines when the order has several products), `{{vars.total}}`
   - `{{vars.pay_link}}`, `{{vars.expires_in}}`
5. Your chat has no link button message yet, so the link goes as plain text at first. A Pay button inside the message is a small later addition.

## 7. Roles, rights and users

Rights are fixed in Phase 1:

| Action | Owner | Admin | Agent | Viewer |
|---|---|---|---|---|
| View orders and payments | Yes | Yes | Yes | Yes |
| Create order, send payment request | Yes | Yes | Yes | No |
| Change quantities, add or remove products | Yes | Yes | Yes | No |
| Give a discount | Yes | Yes | Up to 10% | No |
| Enter a custom amount | Yes | Yes | No | No |
| Mark shipped, delivered or cancelled | Yes | Yes | Yes | No |
| Refund a payment | Yes | Yes | No | No |
| Edit products and prices | Yes | Yes | No | No |
| Manage custom fields | Yes | Yes | No | No |
| API keys and webhooks | Yes | Yes | No | No |
| Razorpay keys and limits | Yes | No | No | No |
| Invite people, change roles | Yes | Yes | No | No |
| View the audit log | Yes | Yes | No | No |

A Viewer sees everything and changes nothing. Buttons are greyed with the note "Your role cannot do this." In Phase 1 the Roles and access screen is read only. The Agent switches, and the limits for discount and largest request, work from Phase 3.

How users are added (this already works in your app):
1. The Owner or an Admin creates an invite link in Settings, Team members.
2. They choose the role (Admin, Agent or Viewer), how many days the link lasts, and an optional label.
3. The link is shown once. They copy it and send it themselves. No email is sent.
4. The person opens the link, signs up or logs in, and joins with that role.
5. Admins can later change a role or remove the person. The Owner can hand over ownership.

The Owner cannot create a login with a password for someone else. One login belongs to one workspace today. A person who works for two businesses needs two logins.

Where the rules live: `src/lib/auth/roles.ts` is the single place for role rules. Every screen and API route calls it, and the database uses the same hierarchy. New rights for orders and payments are added there.

The platform operator (you, seeing across all businesses for support) stays outside these roles. It stays a separate, logged support access.

## 8. The approved screens

The orders mockup has 9 screens. Screen 3 is replaced and screen 6 gets the webhook status light, as marked below. The shared sidebar gets one new item, Orders. Dark mode is shown, as in your app, with your existing colors, fonts and cards.

| # | Screen | New or changed | Built in |
|---|---|---|---|
| 1 | Orders list: summary cards, filters, table | New | Phase 1 |
| 2 | Order detail panel: items, payment, shipping, timeline | New | Phase 1 |
| 3 | Products tab: list, edit panel, Import file, Google Sheet | Replaced | Not built. Products come from the catalogue (decision 16). I show you a product picker inside the order dialog first |
| 4 | Inbox: payment card, Orders panel, Request payment menu item | Changed | Phase 1 |
| 5 | Request payment dialog | Changed | Phase 1 |
| 6 | Settings, Payments: Razorpay keys, webhook address, secret and status light, order automations, template choices | New. The status light is not in the mockup yet | Phase 1 |
| 7 | Small tweaks: custom fields apply to products and orders, Payment received notification, Orders tab on the contact | Changed | Phase 1 |
| 8 | Settings, Roles and access | New | Phase 1 read only, switches in Phase 3 |
| 9 | Automation builder: order triggers and variable list | Changed | Phase 1 |

Not yet mocked up. I show a mockup before building each:
0. The webhook status light in Settings, Payments, and the catalogue product picker in the order dialog (Phase 1, next).
1. Settings, Integrations with field mapping (Phase 3).
2. Number health: message usage card (Phase 3).
3. AI settings: reply mode (Phase 3).
4. Connecting the Shipments sheet (Phase 3).
5. Dashboard revenue card and the Paid badge on Pipelines (Phase 4).
6. Flows order triggers (Phase 4).
7. Stock screens (optional, Phase 4).

## 9. How a payment request works

Three ways start a payment request. All three create the same order and the same link, and the same Razorpay event marks it paid:
1. An agent uses the Request payment dialog in the inbox.
2. The customer taps Buy now on an offer template.
3. The AI takes the order and the customer confirms.

The amount:
1. Before sending, you can change quantities, add or remove products, and give a discount. An Agent can discount up to the limit (suggested 10%). A custom amount is for Admin and Owner. It is off for Agent.
2. After sending, the amount is fixed. To change it, cancel the link and send a new one on the same order. The old link stops working, so the customer cannot pay the wrong amount.
3. An order is Paid only if the amount received equals the order total.
4. The order number is created when you send. The dialog shows a preview of what the customer sees.

The message:
1. If the 24 hour window is open, the customer gets the order summary and link as a free-form message.
2. If the window is closed, the dialog sends the `payment_request` template instead and tells the agent.

## 10. How the product list and shipping details are filled

Orders are not fed in. The system creates them. Products come from your catalogue.

Product list (decision 16):
1. Products are the items already synced into `catalog_items` from your Meta catalogue. WooCommerce stays the master. The Sync now button in the catalogue settings refreshes them.
2. The order dialog picks products from there.
3. Every order keeps a copy of the product name and price at that moment. A later price change never alters an old order.
4. A ₹1 test product with code `TEST1` is needed for testing. We agree in Phase 0 how to add it to the catalogue.
5. A business with no catalogue is decided later.

Rules for the Shipments Google Sheet (Phase 3):
1. Only Google links are accepted, with a row limit and a row by row error report.
2. A published sheet can be read by anyone with the link. Keep secrets and customer data out of it.
3. Google keeps a server copy, so changes can show up late. A few minutes is normal. A Sync now button forces a pull.

Shipping details and order questions:
1. Shipping details live on the Orders page and in the Shipments tab (decision 13).
2. The customer asks "where is my order". The system finds their orders by their WhatsApp number. With several orders it asks which one.
3. The AI replies using only the looked up facts. It never invents a delivery date. If the sheet has no expected delivery text, it says "we will update you" and alerts an agent.
4. It shows details only to the phone number that placed the order.
5. The customer's message opens the 24 hour window, so the reply is free-form and needs no template.

## 11. Data in Supabase

Every table carries an account ID and the same access rules as your other tables. New migrations start at 058.

- `catalog_items`: already exists (migrations 052 to 057). Orders read products from it. There is no separate `products` table.
- `billing_payments`: already exists (migration 055). The platform fee payments (Lane A).
- `orders`: order number, contact, conversation, source, ad details, status, totals, `attributes`.
- `order_items`: product, name and price copied at order time, quantity.
- `payments`: method, Razorpay IDs, amount, status, paid time.
- `order_events`: the timeline of every change and who made it.
- `incoming_events`: every Razorpay event, saved once.
- `payment_providers`: per business, the Razorpay Key ID and Key Secret (encrypted), the webhook token, the webhook secret (encrypted), the time of the last valid event and the time of the last wrong secret event. The last two feed the status light.
- Later: `integrations`, `account_limits`, `audit_log`, `shipments`, `outbox`, agent switches.

Order states: awaiting payment, paid, failed, expired, cancelled, refunded, needs review. Each business can rename stages for display. The money states stay fixed.

## 12. Phases

Sizes are my judgment, not measured.

| Phase | Goal | Size |
|---|---|---|
| R | Razorpay review pack and the platform fee | Built |
| R2 | Platform fee follow ups: webhook safety net, auto renew, Live keys | Small to Medium |
| 0 | Accounts and templates ready | Small |
| 1 | Take a payment, confirm it, record it | Medium |
| 2 | Orders from ads, templates and chat, with AI order taking | Medium |
| 3 | Website API, shipping, order questions, limits | Medium to Large |
| 4 | Advanced items, chosen one by one | Large |

### Phase R: Razorpay review pack (Medium, before Phase 1)

Goal: WAGenie passes Razorpay's review, so the ₹2,500 monthly subscription can be paid.

Decided on 3 Oct 2026:
1. WAGenie is a SaaS. The Shipping Policy does not apply. A short Delivery page says the service is digital and starts online after payment.
2. Price: ₹2,500 per month, plus GST as applicable (GST to be confirmed by the owner).
3. Contact on every page: Parvez Shaikh, parvezaigyaan@gmail.com, Govandi, Mumbai 400043.
4. The first payment flow is one month at a time with Razorpay Checkout. Automatic renewal comes later.
5. Review reference: Razorpay needs Terms and Conditions, Privacy Policy, Shipping Policy, Contact Us, Cancellation and Refunds, About Us and Pricing details, plus Test Account credentials when a login is needed.

You give me or do:
1. Decision: is ₹2,500 plus GST, or does it include GST? Do you have a GST number to show?
2. Decision: refund terms. My suggestion: cancel any time, access runs to the end of the paid month, and a full refund on the first payment if you ask within 7 days.
3. A phone number for Contact Us. Razorpay usually wants one. This is not confirmed in their docs.
4. The business name registered on Razorpay, so the pages carry the same name.
5. Razorpay Test mode Key ID and Key Secret, saved in Vercel as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Never paste them in chat.

What I build:
1. Seven public pages in the landing style: Pricing, Terms and Conditions, Privacy Policy, Cancellation and Refunds, Delivery, About and Contact. The footer and navigation links are fixed, and the "add later" and "blank" placeholders are removed.
2. A Razorpay library: create an order, verify a payment signature, fetch a payment. It is later reused for the payment links in Phase 1.
3. Settings, Billing (Owner only): Pay ₹2,500 with Razorpay Checkout, payment history with receipts, and a Test mode notice. A payment counts only after the server verifies the signature. Each paid receipt adds one month. Migration 055 adds `billing_payments`. The paid until date is worked out from the paid rows, so it is not stored on the account.
4. A separate demo workspace with a test login and fake sample data. It has no WhatsApp number and uses Test mode only.
5. Tests for the signature check, a duplicate payment and the Owner only rule.

You test:
1. Open every footer link. Each page loads and shows the contact details.
2. Log in with the demo account, open Settings, Billing and pay ₹2,500 with the Razorpay test card 4111 1111 1111 1111 (any future expiry, any CVV) or the UPI ID success@razorpay. A UPI QR does not work in Test mode. Expect Paid, a receipt, and the date moving one month on.
3. Log in as a Viewer or Agent in the demo workspace. Expect the Pay button greyed.
4. Add the demo login to Razorpay: Account & Settings, Business website detail, Edit, Test Account credentials. Resubmit.

Done when: Razorpay approves, or tells us the exact reason and we fix it.

Build log, 3 Oct 2026 (built and pushed):
1. Public pages `/pricing`, `/terms`, `/privacy`, `/refund`, `/delivery`, `/about`, `/contact`, with the shared navigation and footer. The footer placeholders ("add later", "blank") are gone. Business details are in `src/lib/site.ts`. No phone number is listed because none was given.
2. Razorpay library in `src/lib/razorpay`: create order, fetch payment, checkout and webhook signature checks. A plain fetch wrapper, no npm package, so it also serves the Phase 1 payment links.
3. Settings, Billing in four languages, with the Owner only Pay button. Routes `GET /api/billing`, `POST /api/billing/order`, `POST /api/billing/verify`. The server fixes the amount, checks the checkout signature, then asks Razorpay for the payment and compares order, amount and status before it adds a month. Settling is safe to repeat.
4. Migration `055_billing_payments.sql` (table `billing_payments`, no user write policy). The paid until date is read from this table. Applied in the live database on 3 Oct 2026. If it is ever missing, Billing shows a plain "not set up" notice.
5. Content security policy and permissions policy now allow Razorpay Checkout.
6. Demo workspace and test login: `node scripts/seed-demo-workspace.mjs`. It made a separate Demo Workspace with fake contacts, chats and deals, and no WhatsApp connection. The login email is `razorpay.review@example.com`. The password was shown once to the owner.
7. Tests: 45 new, 1,334 in total, plus `tsc`, `eslint` and a production build.

Status on 4 Oct 2026: migration 055 is applied, the Test keys are in Vercel, the live check passed, and Razorpay approved the website (reported by you). Still to confirm: the GST wording, the refund terms (first payment refundable within 7 days), a phone number for Contact Us, that the business name on Razorpay matches the pages, and whether to use your own domain instead of wagenie.vercel.app.

### Phase R2: Platform fee follow ups (Small to Medium, after you decide to launch)

Goal: the ₹2,500 subscription is safe and ready for real customers. Until you decide to launch, Lane A stays in Test mode.

You decide:
1. The launch date, when Live keys go in and charging starts.
2. GST: whether the receipt shows GST, and whether you have a GST number to show.
3. What happens when a paid month ends: only warn, warn and then block, or give grace days. Today nothing is blocked.

You give me: the Live Razorpay Key ID and Key Secret for WAGenie, saved in Vercel. Never in chat.

What I build:
1. A webhook safety net for Lane A. The same `pay-webhook` function also settles a subscription payment when the Owner's page never came back. It uses the same checks as today: signature, amount, and once only.
2. Auto renew. I check Razorpay's current options for repeat payments, show you the choices, and build the one you pick. It needs the webhook.
3. A receipt that is ready for GST, if you decide so.
4. What happens when a paid month ends, as you decide.
5. The Test mode notice disappears by itself when Live keys are in.

You do at launch: change the demo account password, or remove the demo login.

You test:
1. In Test mode, pay and close the tab before the page comes back. Expect the month to be added by the webhook safety net.
2. On Live, pay ₹2,500 once yourself. Expect the receipt and the month moving on. Refund it in Razorpay afterwards.
3. Once auto renew is built, expect the next month to be charged and added without anyone opening the page.

Done when: the checks pass and you sign off.

### Phase 0: Setup (Small)

Goal: accounts ready, so Phase 1 can be tested in Test mode. Live comes at launch.

You give me or do:
1. Razorpay: this applies to each business, starting with MJA Print N Gift. Stay in Test mode for now. Confirm the account is activated and settlements are set up, for later.
2. Razorpay: generate the Test mode Key ID and Key Secret (they start with `rzp_test_`). Keep them in a password manager. At launch the business uses its Live keys. If its website already uses the Live keys, ask the website developer for the pair, and do not regenerate them unless you choose "deactivate after 24 hours".
3. Razorpay: choose an alert email. The CRM makes the webhook secret and the address for you in Phase 1 (decision 17). Create the webhook only after I deploy the function, so Razorpay does not retry against an address that does not exist. Events to select: `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.failed` and `refund.processed`. Do not select `payment.captured` or `order.paid`. They fire for your website's normal payments and we do not need them.
4. Razorpay: check which payment methods are on, the settlement bank and schedule, and the business name customers see on the payment page.
5. Meta: confirm your business is verified and that a payment method is on your WhatsApp Business Account. Check this today (see section 6a).
6. Meta: create and submit two templates from Appendix A: the offer template with a Buy now quick reply button, and the payment request template. The others are optional.
7. Meta: confirm your ads send people to this WhatsApp number.
8. Supabase: send me the project URL and project reference ID. These are not secrets.
9. Supabase: install the CLI, log in and link the project. I give you the commands.
10. Supabase: tell me how you run migrations, by CLI or in the SQL editor.
11. Decision: order prefix (suggested `ORD-`), link expiry (suggested 30 minutes), Agent discount limit (suggested 10%), largest single request (suggested ₹25,000).

What I do:
1. Write the final text and button settings for the offer and payment request templates.
2. Check the open items in section 14 against Razorpay's and Meta's docs and report back.
3. Write the step by step Supabase commands.
4. Answer your questions. No code in this phase.

You test:
1. In Test mode, create a payment link by hand in Razorpay and pay it with the test card. It must show in the Razorpay dashboard. The same test with ₹1 is repeated on Live at launch.
2. Check that both templates show Approved in Meta.

Done when: both templates are Approved, keys exist, Supabase is linked, a payment method is on the WhatsApp account and the decisions are given.

### Phase 1: Core. Take a payment, confirm it, record it (Medium)

Goal: from the inbox, send a payment link, get paid, and see the order marked Paid with a confirmation to the customer.

You give me:
1. Phase 0 finished.
2. Your products are already in the catalogue. Add a ₹1 test product with code `TEST1` to it, or we agree another way to test.
3. The webhook address in your Razorpay set to the address shown in Settings, Payments (it includes your own token).
4. The webhook secret from Settings, Payments pasted into the same Razorpay webhook form. The CRM stores it encrypted. Nothing goes into Supabase secrets per business.
5. Razorpay keys saved in Settings, Payments, by you, on the screen I build.
6. The approved offer and payment request template names.
7. Answers to anything the mockup left open.

What I build:
1. The database migration for the tables in section 11.
2. Order numbers per business.
3. A new Orders item in the sidebar. The order dialog picks products from the catalogue.
4. Settings, Payments: keys stored encrypted, Test connection, webhook address and webhook secret made by the CRM and shown once with copy buttons, a webhook status light (Not connected yet, Connected, Problem), order prefix and link expiry, the list of order automations with on and off switches that link to Automations, and the template choices for when the window is closed.
5. Server side payment link creation with a fixed amount, partial payments off, the order number as reference, a note marking it ours, an expiry, and cancel.
6. The `pay-webhook` edge function: finds the business from the token in the address, reads that business's stored secret, checks the signature, ignores payments that are not ours, saves each event once, and updates payment and order in one safe step only when the amount matches. The main event is `payment_link.paid`, because it carries our reference ID and notes. It answers with a 2xx within 5 seconds and does the rest in the background. It also records the time of the last valid event and of the last wrong secret event, for the status light.
7. Automations for orders. New triggers: Order created, Payment received and Payment failed. Each passes the order details as variables (see section 6b). The automation builder shows the variable list. Default automations are installed for each business. When an order is created, the first sends the order summary in the agreed format with the payment link. After Paid, the next adds the Paid tag, sends "order received", waits 5 minutes and sends the offer. You edit all wording in Automations. A fourth default, a follow up for Payment failed, is installed but switched off. If a default automation is missing or off, the system sends a built-in default message instead. A template is used only if the 24 hour window is closed.
8. Orders page with detail panel and timeline.
9. Inbox: Request payment dialog, payment card in the chat, Orders section in the contact panel. If the 24 hour window is closed, the dialog sends the payment request template instead and tells the agent.
10. Notifications for Payment received and Payment failed.
11. Custom fields that apply to orders. Product fields stay as the catalogue has them, and this is reviewed with screen 3.
12. Fixed role rights in `roles.ts`, greyed buttons for Viewer, and a read only Roles and access table in Settings, Team members.
13. Tests for the signature check, duplicate events, wrong amount, ignoring other payments and role rights.
14. The Refund button stays hidden. A refund made in the Razorpay dashboard is recorded as Refunded.
15. A Check payment status button on pending orders. It asks Razorpay directly, in case the webhook is ever switched off.

You test in Test mode. The ₹1 Live tests are repeated at launch:
1. Open the order dialog. Expect the catalogue products with the right prices, including `TEST1`.
2. Save the keys and press Test connection. Expect success.
3. From the inbox, send a `TEST1` payment request to your own number. Expect one message with the order number, product code, product name, quantity, total and the link.
4. Pay with the test card 4111 1111 1111 1111 or the UPI ID success@razorpay. Within a few seconds expect: the order is Paid, the card says Paid, the "order received" message arrives, the Paid tag appears, a notification shows, and the timeline has each step. Five minutes later expect the offer message.
5. In Razorpay, resend that webhook. Expect no change and no second message.
6. Send another request and cancel it or let it expire. Expect Cancelled or Expired and the old link no longer works.
7. At launch, on Live: pay a normal order on your e-commerce website. Expect the website to work as before and nothing to appear in the CRM.
8. Refund the ₹1 in the Razorpay dashboard. Expect Refunded in the CRM.
9. Invite a Viewer and log in as that person. Expect greyed buttons and the note.
10. As an Agent, try a 15% discount and a custom amount. Expect the discount refused and no custom amount option.
11. Change the order summary wording in Automations and send another request. Expect the new wording. Switch that automation off and send another. Expect the built-in default message.
12. In Razorpay, switch the webhook off, pay a ₹1 link, then press Check payment status. Expect the order to become Paid. Switch the webhook back on.
13. Open Settings, Payments. Before the webhook is added in Razorpay, expect "Not connected yet". After the first test payment, expect "Connected" with a time. Put a wrong secret in Razorpay and pay again. Expect "Problem".

Done when: all thirteen checks pass and you sign off.

### Phase 2: Chat and ads (Medium)

Goal: customers can start an order from an ad, an offer template or a chat, and the AI can take the order with a confirmation.

You give me:
1. A live ad or test link that opens WhatsApp to your number, and a product code for it.
2. The product codes for your offers.
3. The offer template with a "Buy now" button, approved in Meta. I give you the text.
4. Decision: how the AI should speak, when it hands over to a human, and what it says when a product is not found.

What I build:
1. Save the ad ID, click ID and source from the first message. Show the source on the conversation, contact and order.
2. The "Buy now" button on offer templates. A tap creates the order for the linked product and sends the order summary and a personal payment link as one free-form message.
3. Product codes typed in chat are recognized. A product list can be sent as a chat list.
4. AI order taking: reads the product list, repeats the order back, waits for a yes, then creates the payment request. It never takes payment without a yes. This needs a new tool calling ability in the AI code.
5. Tests for all of the above.

You test:
1. Click your own ad. Expect the source on the conversation.
2. Tap Buy now on a template sent to yourself. Expect the link, pay ₹1, expect Paid.
3. Type "2 TEST1". Expect the AI to repeat it back and wait.
4. Say no. Expect no order.
5. Say yes. Expect a payment link.
6. Ask for a product that does not exist. Expect a polite reply or a handover.
7. Change a price at the catalogue source and press Sync now in the catalogue settings. Expect the new price on the next order and no change to old orders.

Done when: all seven checks pass and you sign off.

### Phase 3: Open up. Website, shipping, order questions and limits (Medium to Large)

Goal: your website and later other websites can create and track orders through the API, safely and within limits. Customers can ask about their orders and get answers.

You give me:
1. Your website platform (Shopify, WooCommerce or custom) and who builds the website side.
2. A test way to place an order on the website.
3. The courier name and tracking link format.
4. Decision: GST invoices needed or not.
5. Decision: limits per business. I suggest starting values.
6. Decision: push a shipped message (a utility template) or let the customer ask. If you push, the approved template in Meta.
7. A Shipments tab in your sheet with the columns in Appendix B.
8. An API key created in Settings with the scopes I name.

What I build:
1. The Orders API: create an order (returns the order number and payment link), read, list, and update products. It takes an idempotency key.
2. New API scopes: orders read and write, products read and write, payments read. No scope can set an order Paid.
3. Settings, Integrations: each connected website, its key and a field mapping screen.
4. Outgoing signed webhooks: order created, paid, status updated, payment failed, refunded.
5. A return link into WhatsApp with the order number pre-filled.
6. Shipping details on each order: status, courier, tracking number, tracking link, expected delivery text and an internal note. By default no message is pushed. A shipped template is the option.
7. Limits and rate limits per business, and an audit log screen for admins.
8. Supabase Queues for pending messages and Cron to expire orders and re-check pending payments.
9. The Agent switches table and the working switches in the Roles screen, plus the limits for discount and largest request.
10. A message usage card on the Number health page: free-form and template messages this month, with a countdown of the 1,000 free messages.
11. Shipments from the Google Sheet: a Shipments tab keyed by order number. A scheduled sync with a Sync now button reads it, so staff can update the sheet instead of the CRM. A sheet value is applied only when it changed in the sheet since the last sync, so an edit on the Orders page is not overwritten. If both changed, the sheet wins and the timeline notes it.
12. Order lookup, read only, used by both the AI and custom replies. It finds orders by the customer's WhatsApp number. With several orders it asks which one. It returns only that customer's orders, and never another customer's.
13. Two reply modes, chosen per business in the AI settings. AI is the chosen mode: natural language in the customer's language, using only the facts returned by the lookup. If the AI call fails, the existing handoff message goes out and an agent is alerted. Custom message: status based wording you edit, with variables for courier, tracking number, tracking link and expected delivery text. It is sent if the AI is switched off. If the data is missing, the reply says we will update them and an agent is alerted.
14. Tests for all of the above.

You test:
1. Place an order from your website through the API. Expect an order and a link.
2. Send the same order twice with the same idempotency key. Expect one order.
3. Pay. Expect Paid in the CRM and a signed webhook arriving at your website.
4. Use a key without the right scope. Expect a refusal.
5. Go over the rate limit. Expect an error that says how long to wait.
6. Open the return link. Expect WhatsApp with the order number typed in.
7. Mark an order shipped with tracking. Then ask "where is my order" from the customer phone. Expect the AI to answer with the tracking link.
8. Pause the webhook for one payment in Razorpay. Expect the scheduled check to mark it Paid.
9. Turn on custom amount for Agent. Expect the option to appear for an Agent.
10. Open the message usage card. Expect counts that match the messages you sent.
11. In the Shipments sheet, type "Ships in the next 24 hours" for an order and sync. From the customer phone ask "when will my order arrive". Expect the reply to repeat that text and not invent a date.
12. Ask about an order from a different phone number. Expect no order details.
13. Switch to custom message mode and ask again. Expect the status based wording with the right tracking details.
14. Change the courier on the Orders page, then sync with an unchanged sheet. Expect the page change to stay. Then change the same field in the sheet and sync. Expect the sheet value to apply.

Done when: all fourteen checks pass and you sign off.

### Phase 4: Advanced (Large, done in small signed off steps)

Candidates, in the order I suggest:
1. More AI tools beyond order lookup, such as payment status for a customer.
2. Refund button in the CRM for Owner and Admin.
3. Dashboard revenue card and chart, and the Paid badge on Pipelines deals.
4. Flows: the same order triggers (Flows need a small database change to allow them), and a "Send payment request" step in Automations and Flows.
5. The Pay button inside WhatsApp (Meta payment configuration).
6. UPI QR image.
7. Shopify and WooCommerce adapters.
8. A second business with its own settlement.
9. Excel `.xlsx` upload.
10. Stock tracking and writing orders back to your Google Sheet (optional, see section 13).

You give me: the Meta payment configuration steps for item 5, Razorpay fee details for item 6, and your decision on which items to do.
You test: each item on live with ₹1, with checks I list before we start that item.

## 13. Optional: stock and Google Sheet write back

Goal: keep stock right, and let you see orders and stock in your own Google Sheet.

Note: products now come from the catalogue, so the stock columns and the stock number on each product are reviewed with you before this starts.

Why a published sheet is not enough: a sheet published to the web is read only, and that is how the Shipments sheet is read in Phase 3. To write back, the sheet is shared with a service account email as Editor. The same private connection can also read the sheet, so the sheet no longer needs to be public.

Three levels. Each is optional and can be done alone:
1. Orders log tab. The app adds one row per order to a tab in your sheet: order number, date, product code, product name, quantity, total and payment status. It updates the status when it changes. The app owns that tab, so nothing conflicts.
2. Sold and reserved columns. The app writes Sold and Reserved for each product code. You keep an Opening stock column. A sheet formula shows Available as Opening stock minus Sold minus Reserved.
3. Stock control in the app. Stock is counted in Supabase, so two orders at the same moment cannot sell the last item twice. Stock is reserved when the payment link is sent, released if the link expires or is cancelled, and counted as sold when paid. The AI can say "only 3 left". The sheet is a copy, and the place where you add new stock.

Rules:
1. Each side owns its own columns. The app never edits your columns, and you never edit the app's columns.
2. The truth stays in Supabase. A sheet is not safe when two writers change it at once.
3. Writes are batched every few minutes through the queue, to stay inside Google's limits (60 reads and 60 writes a minute per user, 300 a minute per project, no daily limit). A delay of a few minutes is normal.
4. The service account key is stored encrypted, set by the Owner only, per business.
5. A product with no stock number is "not tracked" and never blocks an order.
6. After a refund, an Admin chooses whether to put the item back in stock.

You give me: a Google service account key, the sheet shared with its email, the column layout you want, and your decision: block an order at zero stock, or allow it and warn.

New data: a `stock_movements` ledger (reserve, sell, release, restock, adjust) and a stock number on each product.

You test:
1. Send an order for a product. Expect a new row in the Orders log tab, and the status changing to Paid after payment.
2. Expect Sold and Reserved to change within a few minutes.
3. Order the last item twice at the same moment from two phones. Expect only one to succeed.
4. Let a link expire. Expect the stock released.
5. Edit your Opening stock by hand. Expect the app to pick it up on the next sync and nothing else to break.

## 14. Open items to settle early

1. Resolved 2 Oct 2026: Razorpay cannot edit the amount of a payment link. Only the reference ID, expiry, reminders, the partial payment setting and notes can be updated, and only while the link is in created or partially paid status. Only a link in created status can be cancelled. The plan stands: cancel and resend.
2. Resolved 2 Oct 2026: the payment link events are `payment_link.paid`, `payment_link.partially_paid`, `payment_link.cancelled` and `payment_link.expired`. The paid event carries the link's reference ID and notes, so it is our main event.
3. Resolved 2 Oct 2026: Razorpay allows up to 30 webhook URLs per account, so a second one can sit next to the website's.
4. Razorpay short links look like `https://rzp.io/i/xxxx`, so the template button address can be `https://rzp.io/i/{{1}}`. Confirm with a real link from the client's account before submitting the template. (Phase 0)
5. Razorpay fees on ₹1 test payments and on QR. (Phase 0 and 4)
6. Does a message with a payment link need a template outside the 24 hour window? I expect yes. (Phase 1 test)
7. Is a Meta product catalog needed for the Pay button inside WhatsApp? (Phase 4)
8. Does Razorpay's webhook fire for payments made through the Pay button, with our reference? (Phase 4)
9. The code calls Graph API v21.0, while Meta's current docs use v23.0. Meta retires old versions after about two years, so I check this and raise the version early. (Phase 1)
10. Indian data protection rules for storing customer data, before other businesses use this. (Before launch to others)
11. Confirm the rates in your WhatsApp Manager rate card. Utility ₹0.115 and marketing ₹0.8631 before GST come from provider articles. (Phase 0)
12. Is a promotional message allowed as a free-form message inside the 24 hour window? I expect yes. (Phase 1 test)
13. Is the free ad window 72 hours or 7 days? Three sources say 72 hours and one says 7 days. (Phase 2)
14. Does a payment method need to be on file for the 1,000 free messages? Sources disagree. (Today)
15. Does a tap on a quick reply button of a marketing template open the 24 hour window? I expect yes. (Phase 2 test)
16. Does the `payment.failed` event carry our reference for a failed attempt on a payment link? The docs do not say. Test with a failing card in Razorpay Test mode. (Phase 1)
17. Is there a Razorpay way to send a test webhook event? I have not found one in their docs. The status light therefore turns to Connected on the first valid event, which a Test mode payment link provides. (Phase 1)
18. Do payment links, their events and webhook delivery work fully in Test mode? I expect yes. Check it by hand in Phase 0.

## 15. What the research found

1. One source of truth. Orders and payments live in the database. The chat, the website and the AI all read and write through it.
2. Fixed order states. An order only moves forward through set states. Every change is logged.
3. Duplicate safe webhooks. Payment events can arrive twice or late. Each is saved once by its ID and checked by signature.
4. A to do list for messages. The order change and the pending message are saved together, so a confirmation is never lost.
5. Ad details arrive once. Meta sends the ad ID and click ID on the first message only. Your webhook does not capture them today.
6. Razorpay Payment Links carry a reference ID, notes and a callback URL, so every payment matches our order number.
7. Customization with limits. Other CRMs store custom objects and fields as data, and cap them. Salesforce allows up to 500 custom fields per object on Enterprise.
8. Custom fields in Postgres work best as real columns for core fields plus a JSONB column for custom ones.
9. API safety for many businesses: scoped keys, limits per plan, usage tracking, audit logs and protection against webhook URLs that point at internal servers.

Sources:
- Meta, payments with a payment gateway: https://developers.secure.facebook.com/docs/whatsapp/cloud-api/payments-api/payments-in/pg
- Razorpay, WhatsApp payments: https://razorpay.com/docs/payments/whatsapp/integrate
- Razorpay, Payment Links API: https://razorpay.com/docs/api/payments/payment-links/create-upi.md
- WhatsApp pricing change, Business Today: https://www.businesstoday.in/latest/photo/whatsapp-changes-from-october-1-businesses-will-pay-but-will-you-559031-2026-10-01
- WhatsApp pricing change, Zendesk: https://support.zendesk.com/hc/en-us/articles/11113277351322-Announcing-upcoming-changes-to-WhatsApp-Business-messaging-pricing
- WhatsApp pricing change, respond.io: https://respond.io/blog/whatsapp-pricing-change-2026.md
- India rates, MyOperator: https://myoperator.com/blog/whatsapp-business-api-pricing-india-2026
- Click to WhatsApp ad data, Whapi: https://whapi.cloud/blog/track-click-to-whatsapp-ctwa-clid
- Google Sheets API limits: https://developers.google.com/workspace/sheets/api/limits
- Twenty CRM custom objects: https://docs.twenty.com/developers/backend-development/custom-objects
- Salesforce field limits: https://www.salesforceben.com/salesforce-activity-object-how-to-navigate-field-limit-constraints/
- Postgres custom attributes: https://www.postgresql.org/message-id/CAH7-FAsLYDK3Jy9GN3%3DhY6w%3D2N%3D0CkGW9KmMgKafPx3PGOEDqw%40mail.gmail.com
- Supabase Wrappers: https://supabase.com/docs/guides/database/extensions/wrappers/overview
- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Cron: https://supabase.com/docs/guides/cron
- Medusa commerce modules: https://docs.medusajs.com/resources/commerce-modules
- Order state machine: https://www.besthub.dev/articles/designing-a-12-state-payment-system-state-machine-from-pending-to-completed-def49b07bd63
- Webhook architecture: https://skillselion.com/skills/finsilabs/awesome-ecommerce-skills/webhook-architecture
- Multi business API gateways: https://zuplo.com/learning-center/api-gateway-for-multi-tenant-saas
- Webhook SSRF protection: https://www.getconvoy.io/docs/webhook-guides/tackling-ssrf

## 16. Approval and sign off

Plan approved by: ____________________  Date: ____________

| Phase | Date | Result | Notes |
|---|---|---|---|
| R | 3 Oct 2026 | Built. Razorpay approved (reported 4 Oct) | |
| R2 | | | |
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

## Appendix A: Templates (two are needed)

Meta decides the final category and may change it.

1. `mug_offer_followup` (needed): the offer for broadcasts. "Get {{1}} off with code {{2}}. Tap Buy now to order." Quick reply button "Buy now" tied to a product code. Category: Marketing. About ₹0.8631 per message before GST.
2. `payment_request` (needed): used when we start the conversation or the 24 hour window is closed, such as an agent asking for payment from a customer who has not written in 24 hours, or a reminder to an unpaid customer. "Hi {{1}}, your order {{2}} is ready. Product: {{3}}. Total: {{4}}. Tap below to pay." Button: URL, "Pay now", address `https://rzp.io/i/{{1}}` (confirm with a real Razorpay link first). Category: Utility. Submit this only after the Razorpay link format is confirmed.
3. `order_received` (optional fallback): only if the window is closed when the payment arrives, or for a website order where the customer never chatted. "Thank you {{1}}. We received your payment of {{3}} for order {{2}}." Category: Utility.
4. `order_shipped` (optional): only if you choose to push shipping updates. "Hi {{1}}, your order {{2}} has shipped. Track it here: {{3}}" Category: Utility.
5. `order_delivered` (optional): "Hi {{1}}, your order {{2}} was delivered. Thank you." Category: Utility.

## Appendix B: Google Sheet layouts

Shipments tab (Phase 3). One row per order.
- `order_number`, `status`, `courier`, `tracking_number`, `expected_delivery_text`, `note`.
- Example expected delivery text: "Ships in the next 24 hours".

Optional stock columns (section 13, reviewed before it starts).
- You own `opening_stock`. The app owns `sold` and `reserved`. A formula in the sheet shows `available`.

Optional Orders log tab (section 13). The app owns it.
- `order_number`, `date`, `product_code`, `product_name`, `quantity`, `total`, `payment_status`.

## Appendix C: Meta setup checklist (Phase 0)

Links:
- Meta App Dashboard: https://developers.facebook.com/apps
- Business Settings and System users: https://business.facebook.com/latest/settings
- Get started guide: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- Pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Ads Manager: https://adsmanager.facebook.com

If the client's number already connects in the CRM (Settings, WhatsApp, Test API Connection passes and messages reach the Inbox), skip steps 6 to 19.

1. Open Business Settings and log in as an admin of the client's Business portfolio.
2. Note the portfolio that owns the WhatsApp Business Account (Accounts, WhatsApp accounts).
3. Security Center: check Business verification. Start it if needed. Menu names can differ slightly.
4. Billing and Payments, Payment Methods: add a credit or debit card. Meta does not accept prepaid or virtual cards.
5. On that page open the WhatsApp Business Accounts tab, choose the client's account and link the card.
6. Open the Meta App Dashboard and open the client's app. If none, create one with the use case "Connect with customers through WhatsApp", under the client's portfolio.
7. WhatsApp, API Setup: copy the WhatsApp Business Account ID, then select the sending number and copy the Phone Number ID.
8. App settings, Basic: copy the App ID and App Secret.
9. Business Settings, Users, System users: add a system user with the Admin role.
10. Add assets for that user: the app (Full control) and the WhatsApp account (Full control).
11. Generate a token for the app with `whatsapp_business_messaging` and `whatsapp_business_management` (Meta's guide also lists `business_management`). Choose no expiry if offered. If only 60 days is offered, note the renewal date.
12. Copy the token at once. It is shown once. Keep it in a password manager.
13. Make up a long random Webhook Verify Token.
14. Know the 6 digit two step PIN of the number. Set one if the number is new.
15. In the CRM, Settings, WhatsApp: enter Phone Number ID, WABA ID, token, verify token and PIN. Save Configuration, then Test API Connection.
16. Put the App Secret in the server environment as `META_APP_SECRET`, and the App ID as `META_APP_ID`.
17. App Dashboard, WhatsApp, Configuration, Webhook: callback URL `https://<your app domain>/api/whatsapp/webhook`, with the verify token from step 13. Verify and save.
18. Subscribe to the fields `messages`, `message_template_status_update`, `message_template_quality_update`, `message_template_components_update`, `phone_number_quality_update` and `account_update`.
19. Send a WhatsApp message from your own phone to the number. It must appear in the Inbox.
20. Create and submit the offer template from Appendix A (in the CRM, Settings, Templates, or in WhatsApp Manager). Quick reply button "Buy now". Wait for Approved.
21. Hold the `payment_request` template until the Razorpay link format is confirmed.
22. In Ads Manager, open or create a Click to WhatsApp ad and confirm it points to this number.

What to pull out and where it goes:

| Item | Where to find it | Where it goes |
|---|---|---|
| WhatsApp Business Account ID | App Dashboard, WhatsApp, API Setup | CRM, Settings, WhatsApp |
| Phone Number ID | App Dashboard, WhatsApp, API Setup | CRM, Settings, WhatsApp |
| Access token | Business Settings, System users, Generate token | CRM, Settings, WhatsApp (stored encrypted) |
| Webhook verify token | You make it up | CRM, Settings, WhatsApp, and Meta webhook setup |
| Two step PIN | You choose or already have | CRM, Settings, WhatsApp |
| App Secret | App Dashboard, App settings, Basic | Server environment `META_APP_SECRET` |
| App ID | App Dashboard, App settings, Basic | Server environment `META_APP_ID` |

Never paste the token, App Secret or PIN in chat.

## Appendix D: Razorpay setup checklist (Phase 0)

Links:
- Razorpay Dashboard: https://dashboard.razorpay.com
- Webhook setup guide: https://razorpay.com/docs/webhooks/setup-edit-payments/
- API keys guide: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/
- Payment link events: https://razorpay.com/docs/webhooks/payloads/payment-links/

Do now, in the client's dashboard:
1. Log in. Stay in Test mode for now (the Test mode switch at the top of the dashboard). Steps marked (Live) are done at launch.
2. Check the account is activated, and note the settlement bank account and schedule.
3. Open Payment Links in Test mode, create a link by hand, pay it with the test card 4111 1111 1111 1111, and see it in the transactions. This is the Phase 0 test. (Live) Repeat with ₹1 from your phone at launch.
4. Accounts & Settings, Payment methods: note which are on (UPI, cards, netbanking, wallets).
5. Note the business name and logo shown on the payment page.
6. In Test mode, open Accounts & Settings, API Keys and generate the Test Key ID and Key Secret. The Key Secret is shown only once. (Live) Later, for the Live keys, ask the website developer if the website uses them, and get the pair from them.
7. (Live) If the Live keys must change: Accounts & Settings, API Keys, Regenerate Key, and choose "deactivate after 24 hours". The Key Secret is shown only once.
8. Choose an alert email for webhook failures. The CRM makes the webhook secret and address in Settings, Payments.
9. Keep all of these in a password manager.

Do later, after I deploy the function and you send the Supabase project reference:
10. Accounts & Settings, Webhooks (under Website and app settings), Add New Webhook.
11. Webhook URL: copy it from Settings, Payments. It looks like `https://<project-ref>.supabase.co/functions/v1/pay-webhook?w=<token>`. The address must be public HTTPS and must not use "razorpay" as a domain.
12. Paste the secret from Settings, Payments and enter the alert email.
13. Active events: `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, `payment.failed`, `refund.processed`.
14. Enter the OTP Razorpay asks for. In Test mode the default OTP is 754081.
15. In the CRM, Settings, Payments: save the Key ID and Key Secret, then press Test connection.
16. Nothing else to save. The CRM already holds the webhook secret, encrypted.

Test mode first: Test mode has its own keys and its own webhook. We stay in Test mode until launch. At launch the business swaps in its Live keys, adds a Live webhook the same way, and repeats the ₹1 tests.

In Test mode, pay with the test card 4111 1111 1111 1111 (any future expiry, any CVV) or the UPI ID success@razorpay. Scanning a UPI QR does not work in Test mode.

What to pull out and where it goes:

| Item | Where to find it | Where it goes |
|---|---|---|
| Key ID (starts `rzp_test_` now, `rzp_live_` at launch) | Accounts & Settings, API Keys | CRM, Settings, Payments |
| Key Secret | Shown once when generated, or from the website developer | CRM, Settings, Payments (stored encrypted) |
| Webhook secret | CRM, Settings, Payments (shown once) | Razorpay webhook form. The CRM keeps it encrypted |
| Alert email | The client chooses | Razorpay webhook form |
| Webhook URL | CRM, Settings, Payments (built from the project reference and your token) | Razorpay webhook form |

Never paste the Key Secret or the webhook secret in chat.
