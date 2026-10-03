# Catalogue and basket: plan

Version 1.5, 3 Oct 2026. Steps 1 to 4 are built and pushed to GitHub. Step 4 is waiting for the owner's phone tests.
This file: `docs/catalog-cart-plan.md`
Related plan: `docs/orders-payments-plan.md` (payments and orders). This plan feeds into it.
Feature list: `docs/crm-features.md`

## STATUS BOARD (read this first)

How to read this board:
1. **Me** means Claude. My part is to code, fix and check.
2. **You** means the owner. Your part is to run SQL, run syncs, test on the phone, and decide.
3. Every task for you has numbered steps, what you should see, and what to send me.
4. `[x]` means done. `[ ]` means not done yet.
5. Rule: whenever Claude builds something, Claude updates this board first, then tells the owner the next step.

### NEXT STEP FOR YOU: Task 2 below

### Done by me (Claude)
- [x] Step 1: connect to the Meta catalogue and copy its items into the CRM (Settings, Catalogue, Sync now).
- [x] Step 2: send products from the inbox (one product, a list, or the whole catalogue).
- [x] Step 3: receive a customer's basket, show a basket card, check prices from our own catalogue copy, notify the team.
- [x] Step 4: the Basket Received trigger, the Send Catalogue step, the Send Catalogue flow node, and the Basket Thank You starter template.
- [x] The send error now shows Meta's real reason (it used to say only "Parameter value is not valid").
- [x] Found why some products would not send: Meta marks them "Outdated" for WhatsApp.
- [x] All of it is pushed to GitHub. 1,362 tests pass. The production build works.

### Done by you (owner)
- [x] Ran the SQL for Steps 1 to 4 (migrations 052, 053, 054, 056). All said success.
- [x] Pressed Sync now in the CRM, and ran the WooCommerce product sync once.
- [x] Sent products from the CRM to your phone: a list and a single product both arrived.
- [x] Sent two real baskets from your phone. The card, the notification and the sale prices were correct.
- [x] Opened the Basket Thank You automation, typed the catalogue text, switched it Active and saved it (Task 1).

### Still to do by you
Do the tasks in order. Send me what each task asks for.

**Task 1: Finish the Basket Thank You automation** (DONE 3 Oct 2026, checked by me in the database: saved, active, both steps have text)
- [x] 1. In the CRM, open Automations, then Basket Thank You.
- [x] 2. In the Send Catalogue step, click inside the text box. The grey words are only a hint, so the box is empty.
- [x] 3. Type: Want to see more? Take a look at our catalogue.
- [x] 4. Check the step title shows your text and no longer says "no text yet".
- [x] 5. Switch Active on, at the top right.
- [x] 6. Click Save Draft.
- You should see: a saved message, and Basket Thank You marked active in the list.
- Send me: nothing, unless you see an error. Then send a screenshot of it.

**Task 2: Check that the catalogue button works on the phone**
- [ ] 1. On the customer phone, send "hi" to the business number. This opens the 24 hour window.
- [ ] 2. In the CRM, open Inbox, then the chat with Shaikh Parvez. The top should say "24h remaining".
- [ ] 3. At the bottom, tap the + button, then Send products.
- [ ] 4. Click the Whole catalogue tab, then Send.
- [ ] 5. On the phone, open the new message and tap View catalogue.
- You should see: your catalogue opens on the phone.
- Send me: a screenshot of the phone. If the CRM shows an error, send that too.
- If the catalogue does not open, stop here. Skip Task 4. Send me the screenshot.

**Task 3: Test a basket with the automation**
- [ ] 1. In the same chat, tap +, then Send products.
- [ ] 2. Tick Glitter Mug (#2008) and Couple Name String Art Frame.
- [ ] 3. Click Send 2 products.
- [ ] 4. On the phone, open the message, tap View items, add both, open the cart and send it.
- [ ] 5. In the CRM, open Automations, then Basket Thank You, then its Logs.
- You should see on the phone: a thank-you message with both items and Total ₹2,048. If Task 2 worked, a second message with a View catalogue button follows.
- You should see in the CRM: a basket card and a "Basket received" notification. In the Logs, both steps say success.
- Send me: a screenshot of the phone chat and of the Logs.

**Task 4: Test the Send Catalogue flow node** (only if Task 2 worked)
- [ ] 1. In the chat, open the assigned-to dropdown at the top right. It shows MJA WACRM. Unassign the chat. Flows do not start on a chat that is assigned to a person.
- [ ] 2. Open Flows, create a new flow, and name it Catalogue test.
- [ ] 3. Set the trigger keyword to: shoptest
- [ ] 4. Add three nodes: Start, Send catalogue, End.
- [ ] 5. Set Start as the entry node.
- [ ] 6. On Start, set "Advances to" to Send catalogue.
- [ ] 7. On Send catalogue, type: Here is our catalogue. Set "Advances to" to End.
- [ ] 8. Click Save, then Activate. If a list of problems appears, send me a screenshot.
- [ ] 9. On the phone, send: shoptest
- You should see: the View catalogue message arrives. In Flows, the run for Catalogue test says completed.
- Send me: a screenshot of the phone and of the run.

**Task 5: Clean up after the tests**
- [ ] 1. Assign the chat back to MJA WACRM. Otherwise your Chat AI All Msg flow may answer the test phone.
- [ ] 2. Switch the Catalogue test flow off, or delete it.
- [ ] 3. Decide about Basket Thank You. Leave it Active and every real customer who sends a basket gets the thank-you. Switch it off if you do not want that yet.

**Task 6: Refresh the Outdated products** (any time, not urgent)
- [ ] 1. In WordPress, open Marketing, Facebook, the Shops tab, Troubleshooting, then click Sync products.
- [ ] 2. Wait about 30 minutes.
- [ ] 3. In the CRM, open Settings, Catalogue, and click Sync now.
- [ ] 4. Tell me it is done.
- Why: 70 products are still marked Outdated by Meta, and Meta will not send those on WhatsApp.

**Decision waiting for you**
- [ ] Do you want a small warning in the product picker on products that Meta will not send? Say yes or no. If yes, I show you a mockup first, then build it, then you run one more SQL.

**Waiting on Meta (not in our hands)**
- [ ] The Meta support ticket about the missing shop icon is still open. When Meta replies, tell me what they said.

### Still to do by me (Claude)
- [ ] When Tasks 1 to 4 pass, I mark Step 4 and this whole plan complete.
- [ ] If any task fails, I fix it from your screenshot, then give you the next step.
- [ ] After Task 6, I count the Outdated products again and tell you the result.
- [ ] If you say yes to the picker warning, I mockup, build, push and give you the SQL.
- [ ] Not started, and a separate plan: turning a basket into an order and the payment link (`docs/orders-payments-plan.md`).

## 1. What we are building

A customer opens your product catalogue inside WhatsApp, adds items to a basket and sends it. The CRM reads the basket and makes an order. When Razorpay is approved, the same order gets a payment link.

Three jobs:
1. Show. An agent, an automation or a flow sends products to a customer from the CRM.
2. Receive. The CRM understands the basket the customer sends back.
3. Order. The basket becomes an order with the right names, quantities and prices.

## 2. How it works, in plain words

1. Your website (WooCommerce) feeds its products into your Meta catalogue.
2. The catalogue is connected to your WhatsApp number.
3. The customer sees the products in the chat. They add some to a basket and send it.
4. Meta sends the basket to our webhook as a message of type `order`.
5. The CRM saves the basket, checks every item against the catalogue, and creates the order with the status "awaiting payment".
6. Later, the payment link goes out (orders plan). Razorpay confirms. The order becomes Paid.

Your website cart and the WhatsApp basket are two separate carts. They share one thing: the product list.

## 3. Where we are today (checked 2 Oct 2026)

1. Catalogue "Products for MJA Print-n-Gift". Meta's real catalogue ID is `371059440191188`. The long number in its name, `1267630016737746`, is not the catalogue ID. Commerce Manager shows 134 products. Meta lists 326 items, because every variant is an item, and the item data holds 165 distinct groups. I do not know why Commerce Manager says 134. Data sources: WooCommerce and a product feed.
2. Connected in WhatsApp Manager to +91 87794 71874. Both switches are On: the catalogue icon in the chat header, and the Add to basket button.
3. The shop icon does not show yet on that number. +91 88504 71874 shows it. The cause is not known. See section 9.
4. The CRM does not understand baskets. From the code, a basket would show in the inbox as "[Unsupported message type: order]" (`parseMessageContent` in `src/app/api/whatsapp/webhook/route.ts`, the `default` case). This is read from the code and not yet tested on a real basket.
5. Two notices in Commerce Manager:
   1. "Products not matching ad events". This is about the website pixel and ads. It does not affect this work.
   2. "Product details are not being updated". The data file "Products for MJA Print-n-Gift – Feed" has had no uploads since 9 Jan 2024. Prices may be old. Check before go live (Phase 0).
6. The orders tables from the orders plan are not built yet.

## 4. Decisions

1. WooCommerce stays the master for products. The CRM only reads the catalogue. It never writes to it.
2. The join key is the item ID that Meta sends in the basket (`product_retailer_id`). We store it on our product record.
3. WooCommerce variants are separate catalogue items that share a group ID. The basket carries the variant ID. We keep the group ID to show the product name properly.
4. We never trust the price inside the basket. We compare it with our own copy of the catalogue. If they differ, or the item is unknown, or the item is out of stock, the order goes to "needs review" and no payment link is sent.
5. We do not depend on the shop icon. The CRM sends a catalogue message with a button, which works on any number.
6. Meta allows one catalogue per WhatsApp Business Account. The CRM stores one catalogue ID per account, like the WhatsApp connection.
7. The payment link comes from the orders plan. Until Razorpay is live, an order stays "awaiting payment" and an agent follows up by hand.
8. Catalogue messages are sent inside the 24 hour window (the customer wrote first). Outside the window an agent uses an approved template. I expect this, and we confirm it in Phase 1.

## 4a. Scope for the first build (decided by the owner, 2 Oct 2026)

Left out for now, because they belong to the orders plan:
1. Razorpay keys, payment links and the Paid step.
2. Creating order records and the Orders page.
3. Order tracking, shipping details and the AI "where is my order" answers.
4. The Orders API, the Google Sheet sync and stock tracking.

Built now:
1. Connect to the catalogue and read its items into a cache.
2. Send products from the inbox.
3. Receive a basket, show it as a basket card in the chat, and notify the team.
4. A trigger, a step and a flow node for Automations and Flows.

What changes because of this:
1. A basket is saved and shown as a card. It is not turned into an order. The agent follows up by hand.
2. The card shows items, quantities and a total worked out from our own copy of the catalogue. It flags unknown items, changed prices and out of stock items.
3. The catalogue copy goes in a small new table, `catalog_items`, instead of the `products` table from the orders plan. When the orders plan starts, orders link to it.
4. The saved basket (`basket_payload`) is what the orders plan turns into an order later, so no work is lost.
5. In section 7, items 2 and 4 are not part of the first build. In section 8, Phase 2 steps 3 and 4 (match to products, create the order) move to the orders plan. The rest of Phase 2 stays.

## 5. Rules that never change

1. The order total comes from our data, never from the basket.
2. A basket is saved once, by Meta's message ID. A repeat delivery changes nothing and sends nothing.
3. A basket never creates a payment link when anything is unknown, out of stock or different in price.
4. Quantities follow the basket, up to 99 per item (Meta's limit).
5. Tokens stay encrypted. Catalogue calls are read only.
6. Only agent, admin and owner can send products. Viewer cannot. Same rule as sending messages today (`canSendMessages` in `src/lib/auth/roles.ts`).
7. The basket must never be mixed with orders from the website. Website orders do not appear in the CRM (orders plan decision 1).

## 6. Screens

Every screen below gets a mockup in the Design canvas, approved by you, before any code.

1. Inbox: a "Send products" item in the plus menu. A picker with search. Choose one product, a group of up to 30, or the whole catalogue.
2. Inbox: a basket card in the chat. Items, quantities, total, and a status line (awaiting payment or needs review).
3. Products page: a Catalogue block. Connected or not, product count, last sync time, a Sync now button.
4. Settings, WhatsApp: a catalogue row. Catalogue ID, cart on or off, icon on or off, and a Check catalogue settings button.
5. Automations: new trigger "Basket received" and new step "Send catalogue". Flows: new node "Send catalogue".
6. Orders list: the source "WhatsApp basket".

## 7. Data and database changes

1. `whatsapp_config`: add `catalog_id` and `catalog_checked_at`. The CRM finds the ID by asking Meta for the catalogues of the WhatsApp account.
2. `products` (planned in the orders plan): add `meta_retailer_id`, `meta_group_id`, `image_url`, `availability`. Add the source value `meta_catalog`. One row per catalogue item.
3. `messages`: widen the `content_type` CHECK to allow `order` (the same job migration 010 did for `interactive`). Add a `basket_payload` JSONB column for the raw basket.
4. `orders` (planned): source value `whatsapp_basket`. A unique key on Meta's message ID per account, so one basket makes one order.
5. `flow_nodes`: widen the `node_type` CHECK to allow `send_catalog` (the same job as migrations 046 and 048).
6. Automations: `trigger_type` and `step_type` are plain text columns with no CHECK, so no migration. Only app code changes.
7. Lesson from the carousel work: before calling any phase done, search `supabase/migrations/` for a CHECK constraint on the column we widen. `tsc` and the tests do not touch a real database.

Code places to change:
- `src/lib/whatsapp/meta-api.ts`: read catalogue, send product, send product list, send catalogue message.
- `src/lib/whatsapp/interactive.ts`: new payload kinds and limits (30 products, 10 sections).
- `src/lib/whatsapp/send-message.ts`: the send path, and `VALID_MESSAGE_TYPES`.
- `src/app/api/whatsapp/webhook/route.ts`: parse the `order` message.
- `src/components/inbox/`: picker, basket card.
- `src/lib/automations/` and `src/lib/flows/`: trigger, step and node, plus the engine and the validators.
- `messages/*.json`: all four languages. A test enforces matching keys.
- Read the Next.js docs in `node_modules/next/dist/docs/` before writing any route code, as `AGENTS.md` requires.

## 8. Phases

Sizes are my judgment, not measured.

| Phase | Goal | Size |
|---|---|---|
| 0 | Checks and setup | Small |
| 1 | Send products from the inbox | Medium |
| 2 | Receive a basket and make an order | Medium |
| 3 | Automations and Flows | Small to medium |
| 4 | Later items | Chosen one by one |

### Phase 0: Checks and setup (Small)

You do:
1. Check the 2 notices in Commerce Manager. Compare 3 product prices in the catalogue with your website. Check the last upload date under Catalogue, Data sources.
2. From a second phone, open the chat with +91 87794 71874 and tap the business name. Note if a Catalogue section shows.
3. Send a basket from that phone, if you can, and tell me what the inbox shows. We save the real payload as a test sample.
4. Give me your OK to run one read only check of the commerce settings for +91 87794 71874.

I do:
1. Run that read only check. It returns whether the cart and the catalogue icon are on.
2. Find out which token permission is needed to read the catalogue, and whether yours has it.
3. Confirm the Graph API version to use.

Done when: we know the catalogue is connected on the API number, the token can read it, and the prices are right.

Results so far (2 Oct 2026). A read only check against Meta, using the token saved in the CRM. Nothing was changed. The results were the same on Graph versions v21.0 and v23.0, so the version is not the cause.
1. The CRM connection is +91 87794 71874, "MJA Print N Gift", status connected.
2. Commerce settings for that number came back empty (`data: []`). Meta has no cart or catalogue setting saved for it through the API. Meta's defaults are cart on and catalogue icon off. This is the most likely reason the shop icon does not show. It does not match the On switches in WhatsApp Manager, so the Manager switches may not have been saved the way the API reads them. This is a likely cause, not a proven one.
3. The token has these permissions: `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`. It has no catalogue permission.
4. The first token could not read the catalogue. Meta answered "missing permission or reviewable feature". Asking the WhatsApp account for its catalogues gave "this application has not been approved to use this api".
5. So reading the product list from Meta does not work yet. Sending product messages may still work, because that uses the messaging permission and the catalogue ID. We find out in Phase 1.

What this changes:
1. To read the catalogue from Meta we need the system user to have access to the catalogue as an asset, and a token that includes the catalogue permission (`catalog_management`). If Meta will not offer that permission to this app, we use another source for the product list: the WooCommerce store, or a CSV export from Commerce Manager.
2. Turning the catalogue icon on through the API is a write to the live number. We do it only with the owner's OK.

Update after the new token (2 Oct 2026):
1. The new token has `catalog_management`. Asking the WhatsApp account for its catalogues now works. It returns one catalogue, ID `371059440191188`. So the CRM can find the catalogue ID by itself and needs no manual entry.
2. The CRM can read the catalogue. Meta reports 326 items. Each item gives `retailer_id`, name, price, availability and a group ID. Three items read back: "Wooden Artistic Frames V1.2" (₹1,210, in stock), "Magic Mug" (₹300, in stock), "White Mug" (₹200, in stock).
3. The item IDs come in two styles. WooCommerce items look like `13738612713_2713`. Others look like `1556110071pages_commerce_sell…`, which looks like an older Facebook shop. Check for duplicates, because one product could be in the catalogue twice.
4. Phase 1 plan note: Meta's paging links are on Graph v26.0. The code uses v21.0. Raise the version early.
5. The icon write failed. Three attempts to set `is_catalog_visible` and `is_cart_enabled` returned HTTP 500, code 1, "An unknown error has occurred". Meta trace IDs: `AbUsK1rVJNDvd431VxxJq5K` and `AoI2q6HVKyphKnv8cZ17xhJ`. The setting is unchanged (still empty), so nothing changed on the live number.
6. Next try: switch the two options Off, save, then On again in WhatsApp Manager, and read the setting back through the API. If it is still empty, raise it with Meta support using the trace IDs.
7. Result of that try: the owner switched both options Off and On again. The API setting stayed empty, and a fourth write attempt failed the same way (trace ID `AOQBXhHb_2RWXX5fRyLrUpv`). We stop retrying. The catalogue is still connected to the WhatsApp account (`371059440191188`). The API answer being empty may only mean the API does not mirror the Manager switches, so the real test is the second phone. If the icon is still missing there, raise it with Meta support using the three trace IDs.

### Phase 1: Send products (Medium)

I build:
1. Read the catalogue from Meta into `products` (read only), with a Sync now button.
2. The three message types: one product, a product list, and the catalogue message.
3. The inbox "Send products" picker and the chat bubbles for what was sent.
4. Tests, and the four language files.

You test:
1. Send one product to your phone. Expect a card with a View and Add to basket button.
2. Send three products. Expect a list that opens.
3. Send the whole catalogue. Expect the catalogue message with a button.
4. Try it as a Viewer. Expect the menu item greyed.
5. Try after 24 hours of silence. Note what Meta says.

Done when: all five checks pass and you sign off.

### Phase 2: Receive a basket, make an order (Medium)

Needs the orders tables from Phase 1 of the orders plan.

I build:
1. Webhook parsing for the `order` message. Save `basket_payload`.
2. The basket card in the inbox.
3. Match each item to our product by `meta_retailer_id`. Check price, stock and unknown items.
4. Create the order as "awaiting payment", or "needs review".
5. A notification "Basket received".
6. Tests for repeat delivery, unknown item, wrong price, out of stock and quantity limit.

You test:
1. Add 2 items on your phone and send. Expect the card and the order within seconds, with the right prices.
2. Redeliver the same webhook from Meta. Expect one order.
3. Send a basket with an item you removed from the catalogue. Expect "needs review" and an alert.
4. Change a price in WooCommerce, sync, send a basket. Expect the new price.

Done when: all four checks pass and you sign off.

### Phase 3: Automations and Flows (Small to medium)

I build:
1. Automation trigger "Basket received", with the variables `{{vars.order_number}}`, `{{vars.items}}` and `{{vars.total}}`.
2. Automation step "Send catalogue".
3. Flow node "Send catalogue", with the database change in section 7.
4. A default automation that sends the order summary when a basket arrives.

You test:
1. Type "catalogue" to your number. Expect the catalogue.
2. Send a basket. Expect the order summary message.

Done when: both checks pass. The payment link arrives in this message once the orders plan Phase 1 is live.

### Phase 4: Later

Choose one at a time:
1. Multi product broadcast templates (Meta must approve them).
2. Product carousel messages.
3. A scheduled catalogue sync.
4. A stock check from the availability field.

## 9. The shop icon (open question)

What we know:
1. Meta's default for the catalogue icon is off. The WhatsApp Manager switch for +91 87794 71874 shows On.
2. Meta says the cart icon is not shown in the chat header for messages sent through the Cloud API. That is the cart icon, not the shop icon.
3. A Meta community thread reports the catalogue icon disappearing while the setting still said visible. It had no answer.
4. Meta's docs say nothing about a delay.
5. +91 88504 71874 shows the icon. We do not yet know if it is a WhatsApp Business app number and the other an API number.

What we do:
1. Phase 0 check of what Meta really saved.
2. If both settings are true and the icon is still missing, it is a Meta display matter. We carry on, because we send the catalogue ourselves. We can raise it with Meta support.
3. If a setting is false, we set it through Meta's API, with your OK first.

The icon does not block any phase.

## 10. Open items

1. Which token permission reads the catalogue. I expect a catalogue permission. Confirm in Phase 0.
2. Does a catalogue message or product message need the 24 hour window? I expect yes. Phase 1 test.
3. The exact shape of the basket message. Capture a real one in Phase 0.
4. Do WooCommerce variants show properly in product lists? Phase 1.
5. Is the basket price tax inclusive? Check against GST on the website. Phase 2.
6. Is the WooCommerce sync current, and is the old feed file a leftover? Phase 0.
7. The Graph API version in the code is old (orders plan open item 9). Raise it in Phase 0.
8. India online selling rules for the catalogue. Meta says India businesses must follow them.
9. How to refresh the 70 items whose WhatsApp status is still Outdated. Cause confirmed (Step 2b). Try the WooCommerce sync again later and recount.
10. Commerce Manager shows 134 products and the API returns 326. Still unexplained. The 39 hidden items and the three feeds may be part of it.

## 11. Sources

- Catalogues overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/
- Set commerce settings: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/set-commerce-settings
- Receive responses from customers: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/receive-responses
- Multi product message templates: https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/mpm-template-messages
- Single and multi product messages (360dialog): https://docs.360dialog.com/docs/messaging/catalogs/single-and-multi-product-messages
- Products and catalogues (360dialog): https://docs.360dialog.com/docs/messaging/products-and-catalogs
- Community thread, icon not showing: https://developers.secure.facebook.com/community/threads/296085003435053/

## 12. Approval and sign off

Plan approved by: ____________________  Date: ____________

| Phase | Date | Result | Notes |
|---|---|---|---|
| 0 | | | |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

## 13. Build log

### Step 1: connect and read the catalogue (built 2 Oct 2026, not yet pushed)

Built:
1. `supabase/migrations/052_catalog_items.sql`: the `catalog_items` table and the `catalog_id`, `catalog_name` and `catalog_synced_at` columns on `whatsapp_config`. **Must be applied in the Supabase SQL editor before the card works.** The CI "Migrations" check replays it on push. `supabase/ci/verify-schema.sql` now asserts it.
2. `src/lib/whatsapp/catalog.ts`: price parsing, availability, the row mapping, `effectivePrice`, and plain-words error text.
3. `src/lib/whatsapp/meta-api.ts`: `getWabaCatalogs`, `getCatalogProducts` and `getCommerceSettings`, all read only.
4. `src/lib/whatsapp/catalog-sync.ts`: copies the whole catalogue first, then writes. An empty answer from Meta never wipes the stored copy. A catalogue over 5,000 items is refused.
5. Routes: `GET /api/catalog` (any member), `POST /api/catalog/sync` (admin and owner), `GET /api/catalog/settings` (admin and owner).
6. `src/components/settings/catalog-card.tsx`, shown under the WhatsApp connection in Settings. Translations added in all four languages.
7. Tests: 39 new. The full suite passes (1,190), plus `tsc` and `eslint`.

Checked on the real catalogue, read only, with the new code and nothing written to the database: 326 items read in 5 pages, 326 rows built, 0 skipped, 0 duplicates, every item has a price, an image and a group, 317 in stock and 9 out of stock, all INR.

What the real data taught us:
1. **149 of 326 items carry a lower `sale_price`.** None has sale dates. The price a customer sees in WhatsApp is the sale price, so the CRM stores both and uses `effectivePrice` (the sale price when it is lower, otherwise the normal price). Example: Magic Mug is ₹300 with a sale price of ₹225.
2. The mockup used normal prices (Magic Mug ₹300, White Mug ₹200, Wooden Artistic Frames V1.2 ₹1,210). The picker and the basket card must show the sale price, with the normal price struck through. Update the mockup before Step 2 and Step 3.
3. Open question for Step 3: which price does Meta put in a basket (`item_price`), the sale price or the normal one? We learn it from the first real basket. The check accepts the sale price, and flags anything that matches neither.

### Step 2: send products from the inbox (built and pushed 2 Oct 2026)

Built:
1. `supabase/migrations/053_catalog_item_variants.sql`: `size` and `color` on `catalog_items`. **Must be applied before this code is pushed**, because the sync now writes both columns and the picker reads them. After applying it, press Sync now once so the columns fill in. `verify-schema.sql` asserts it.
2. Three new message kinds in the shared interactive payload: `product` (one card), `product_list` (up to 30 products in up to 10 sections) and `catalog` (a View catalogue button). Validation in `interactive.ts`. The payload keeps a `display` snapshot (name, variant, price, image) so the chat keeps drawing the card after the catalogue changes. The snapshot is never sent to Meta.
3. Meta senders in `meta-api.ts`: `sendInteractiveProduct`, `sendInteractiveProductList`, `sendInteractiveCatalog`. Payload shapes are from Meta's single product, multi product and catalogue message pages.
4. `src/lib/whatsapp/product-message.ts`: turns a picker selection into the right message. One product sends a card, two to thirty send a list, "Whole catalogue" sends the catalogue message.
5. `src/components/inbox/product-picker.tsx` and a "Send products" item in the composer's plus menu. Search by name or ID, variant and ID on every row, the sale price with the normal price struck through, out of stock items disabled, up to 30 selected, an editable message and list title. It reuses the normal send route, so it follows the 24 hour window and the viewer rule like every other message.
6. The chat bubble draws all three kinds, in four languages. The Interactive builder and Quick replies show a product payload read only. Automations refuse it for now (Step 4).
7. Tests: 100 new. The full suite passes (1,240), plus `tsc` and `eslint`.

Real data behind the design (read only):
1. 74 product names are shared by several items, because variants carry the same name. Size or colour separates most of them. 41 of those 74 names stay identical even then, so every row also shows the item ID.
2. Items with no size and no colour show the ID only.

Result on a real phone (2 Oct 2026, owner test): a product list reached the customer's phone, and the picker looked right after one layout fix. The database shows only lists were sent that day, so a single card and the catalogue message were not yet confirmed. Single cards later failed for some items, see Step 2b.

Layout bug found in that test and fixed (commit 974aa9c): the dialog is a grid whose column grows to fit its widest line, and a long product name anywhere in the list pushed the search box, list and prices past the dialog's edge. The picker's dialog now has a column that may shrink. Reproduced in Chrome before fixing (265px overflow with a 110 character name) and checked after.

Still to confirm on a real phone (Phase 1 test list):
1. That the single card, the list and the catalogue message open as designed on the customer's phone.
2. Whether a catalogue message works without the shop icon on this number.
3. Whether Meta accepts a product list with one section titled the same as the header.
4. What Meta says when the 24 hour window is closed.

### Step 3: receive a basket (built and pushed 2 Oct 2026, commit bdf91d1, tested on a real phone)

Built:
1. `supabase/migrations/054_catalog_basket.sql`: `messages.content_type` allows `order`, `messages.basket_payload` (JSONB), and `notifications.type` allows `basket_received`. **Apply it before this code is pushed.** `verify-schema.sql` asserts all three.
2. `src/lib/whatsapp/basket.ts` (pure): reads Meta's `order` object, checks each line against our `catalog_items` copy, works out the total from catalogue prices, and flags problems: unknown item, out of stock, no price, price mismatch, bad quantity (1 to 99), catalogue lookup failed. The raw order is kept on the basket.
3. The webhook (`src/app/api/whatsapp/webhook/route.ts`) saves a basket as a message of type `order` with the checked basket, shows "Basket: 3 items, ₹599" in the conversation list, and notifies the team.
4. `src/components/inbox/basket-card.tsx`: the basket card in the chat, as in the approved mockup, with sale prices, flags, the total and a status line. Four languages.
5. Notifications: the assigned agent when the chat has one, otherwise the owner, admins and agents. Never viewers. The notifications page has a shop-bag icon for it.
6. Tests: 49 new, plus 12 for the webhook. The full suite passes (1,289), plus `tsc` and `eslint`.

Safety rules built in:
1. **A basket never feeds the AI bot, keyword automations or the flow runner.** It is not text the customer typed. Before this step the webhook fed "[Unsupported message type: order]" to all three. `new_message_received`, `first_inbound_message` and `new_contact_created` automations still fire, with an empty message text.
2. **The total is always from our catalogue prices.** A basket price that matches neither the sale price nor the normal price is flagged "price mismatch". It is never trusted.
3. **If the database is not ready (migration 054 missing), the basket is stored the old way** (as plain text, "[Unsupported message type: order]") and the rest of the message handling runs as before. The `basket_payload` column is sent only for a basket, so ordinary messages are unaffected either way.
4. A replayed delivery notifies nobody.
5. An order with no usable items is stored the old way.

Result of the first real basket (2 Oct 2026, 18:09 UTC, one Box Frame Pendent, Silver):
1. It reached the inbox as a basket card, with the right total (₹495), status "all items match", and a "Basket received" notification. The shop icon was not needed to get a basket. The product list sent from the CRM sits just above it in the chat.
2. **`item_price` is in rupees, not paise.** Meta sent `495` for a ₹495 item.
3. **For an item on sale, Meta sends the sale price.** Second real basket (2 Oct 2026, 18:28 UTC): Couple Name String Art Frame, normal price ₹2,100, sale price ₹1,749. Meta sent `item_price: 1749`. The customer's cart showed ₹1,749 with ₹2,100 struck through and "You save ₹351", and the CRM card showed the same with a total of ₹1,749. The check still accepts either price, and the total is still worked out from our catalogue.

Not built (belongs to step 4 or the orders plan): a "Basket received" automation trigger, turning a basket into an order, and the payment link.

### Step 2b: items Meta will not send (found 3 Oct 2026, owner test)

What happened:
1. A single product card failed with Meta error `#131009 Parameter value is not valid`. With the details line now shown (commit bc01c11) the reason reads: "product not found for product_retailer_id 3598 in catalog_id 371059440191188". Another single send said: "None of the products provided could be sent. Please check your catalog."
2. A list of two products reached the phone with only one of them. The CRM bubble drew both, because it draws from our own copy of the catalogue, and Meta still reported the message as delivered. Meta drops items it cannot find from a list without saying so. It complains only when nothing in the message can be sent.
3. Meta's own product list shows the failing items (3598, 2008) as published and in stock. Reading the catalogue and sending a message disagree about them.

What we found in the catalogue (read only, 326 items):
1. 200 items have a short ID (digits only, the website's product number) and 126 have a long ID (with an underscore). Only 52 short items have a long twin. 148 exist only as a short ID. "Use the long ID" is therefore not a general fix.
2. Meta keeps a separate WhatsApp review status per item (`capability_to_review_status`, key `WHATSAPP`). Across the catalogue: 210 approved, 106 outdated, 10 no review. Short IDs: 125 approved, 73 outdated, 2 no review. Long IDs: 85 approved, 33 outdated, 8 no review. The ID shape does not decide it.
3. The two items that failed (3598, 2008) are Outdated. The item that went through in a list (`TG0FRM00001212001CAD_2727`) is Approved. "Outdated" usually means the item changed after Meta last reviewed it, for example a new price.
4. A first reading found two things that did not fit. Both were wrong. The Advocate Pen that was sent as a single card was `COM000BLK0000036RNC_2579` (Approved), not the Outdated `65589172579_2579` that the picker screenshot showed. The first failed cushion send was made before the details line existed, so its ID is unknown. No counterexample remains.
5. The catalogue has three feeds. Two come from the Facebook for WooCommerce plugin (145 items, last upload 22 Jun 2026, and 90 items, last upload 21 Aug 2026). The third is the "Products for MJA Print-n-Gift" feed, with no upload details. 39 items have visibility "hidden".

Built:
1. The send path now shows Meta's `details` line, so the next rejection names the bad parameter (commit bc01c11).

Retest after the WooCommerce product sync (3 Oct 2026, owner test, confirmed on a real phone):
1. The sync moved 36 items from Outdated to Approved (Outdated 106 to 70, Approved 210 to 247). Meta now has 327 items.
2. The Glitter Mug (`2008`) was Outdated and failed as a single card. After the sync it is Approved and the single card reached the phone (10:40 UTC).
3. A list with two cushion items, `CCSSATHB01212001PNG_352` (Approved) and `5539817352_352` (Outdated), reached the phone as "1 item" (10:41 UTC). Meta dropped the Outdated one without saying so.
4. Every item sent that day is Approved (one is No review). Every item that failed or was dropped is Outdated. **The cause is confirmed: Meta will not send an item whose WhatsApp status is Outdated.** The ID shape (short or long) does not matter.
5. 70 items are still Outdated (61 added by the plugin through the API, 9 from the older feed, last uploaded 22 Jun). How to refresh them is not yet known. Re-running the sync later, and recounting, is the first thing to try.

Next, waiting for the owner's go-ahead (needs a migration and a small change to the picker rows, so a mockup first): save each item's WhatsApp status when the catalogue syncs, and show a "Not approved for WhatsApp yet" warning on those rows in the picker. Warn only. The warning stops the CRM bubble from promising products the customer will not see.

### Step 4: automations and flows (built and pushed 3 Oct 2026, commit 4946ffd; migration 056 applied by the owner; phone test pending)

Built:
1. `supabase/migrations/056_flow_send_catalog_node_type.sql`: adds `send_catalog` to the `flow_nodes.node_type` allow-list (same job as migrations 046 and 048). Without it, saving a flow that has the new node fails. Automations need no migration, because their trigger and step types are free text. `verify-schema.sql` asserts it.
2. Automation trigger **Basket received** (`basket_received`). It has no settings. The webhook fires it only for a basket that was really stored, after the idempotency check, so a replayed delivery never thanks a customer twice, and the plain-text fallback never fires it. Variables: `{{vars.name}}` (the customer's name, or "there"), `{{vars.item_count}}`, `{{vars.items}}` (one line per item, "2 x Magic Mug (Gold)") and `{{vars.total}}` (from our catalogue prices, or "to be confirmed" when any line cannot be priced, so a message never states a wrong total). They come from `basketAutomationVars` in `basket.ts`. `{{vars.order_number}}` from the first plan is not built, because there is no order yet.
3. Automation step **Send catalogue** (`send_catalog`): text above a View catalogue button, optional footer, `{{vars.*}}` fills in. Checked against Meta's limits at save time and again before sending.
4. Flow node **Send catalogue** (`send_catalog`): the same message, then it moves on to the next node, like Send template.
5. One shared sender, `engineSendInteractiveCatalog` in `src/lib/flows/meta-send.ts`, used by both. It saves the message in the chat with its payload, so the bubble draws like one sent from the inbox.
6. Starter template **Basket Thank You** on the Automations page: Basket received, then a message that thanks the customer and lists the basket and total. It starts as a draft. The page's template row is now 5 wide on large screens.
7. Four languages. Tests: new ones for the helper, the engine step, the validators, the flow node (running it, the blank footer, a failed send), the edges and the webhook trigger. The full suite passes (1,362), plus `tsc`, `eslint` and a production build.

Safety:
1. The trigger fires in addition to `new_message_received`, as before. An account that has a "reply to every message" automation will send that reply and the basket thank you. Turn the first one off, or give it a condition, if that is not wanted.
2. A Send catalogue step or node only works inside the 24 hour window, and only when the catalogue is connected to the sending number. Otherwise the step fails and the run log says why.
3. Nothing is turned on by default. The starter template is a draft until the owner activates it.

To test on a real phone: see Tasks 1 to 5 in the STATUS BOARD at the top of this file. Migration 056 is applied (owner confirmed, 3 Oct 2026).
