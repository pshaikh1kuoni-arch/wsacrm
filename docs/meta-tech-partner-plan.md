# Meta Tech Partner plan

Goal: become a Meta Tech Provider, then a Tech Partner.
First phase: internal tracking of quality, limits, volume and active customers.

## Meta requirements

### Tech Provider
1. Meta app with the WhatsApp use case, linked to a business portfolio.
2. Two-factor authentication on and business verification done.
3. App Review with advanced access to `whatsapp_business_messaging` and `whatsapp_business_management`.
4. App settings filled in: icon, privacy policy URL, app category.
5. Two demo videos: a message sent and received, and a template created.
6. Webhooks working.
7. Customers add their own payment method in Meta.

### Tech Partner (upgrade)
1. Already a Tech Provider.
2. At least 2,500 messages a day on average over 7 days (or 200 calls a day).
3. At least 10 active business customers (1 message or more in the last 30 days).
4. Phone number quality rating of 90% or better.

The numbers come from the 360dialog guide. Confirm them with Meta.

## Where we are

Done in Meta:
- App created, App ID `1627306712437909`.
- Phone number +91 87794 71874 connected.
- Display name "MJA Print N Gift" approved.

Quality rating is empty in Meta for now. A new number gets a rating after it sends messages.

## Still to do before coding

1. Add `META_APP_ID` to Vercel environment variables (done locally in `.env.local`).
2. Make sure every variable from `.env.local` is also set in Vercel, then redeploy.
3. Set `WHATSAPP_TEMPLATES_DRY_RUN=false` (or remove it) so templates reach Meta.
4. Set `NEXT_PUBLIC_SITE_URL` to the Vercel domain in Vercel.
5. Confirm the Meta callback URL is `https://<vercel domain>/api/whatsapp/webhook`.
6. Confirm webhook fields are subscribed: `messages`, `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_update`.
7. Confirm all Supabase migrations are applied.
8. Confirm the system user token is saved in Settings, WhatsApp connection.
9. Send a test message both ways and check the inbox.
10. Start business verification and turn on two-factor authentication.

## Build steps

1. Mockup of the internal dashboard in Design canvas. Approve before code.
2. Migration: table for phone number quality and messaging limit, table for daily message counts.
3. Webhook handler for `phone_number_quality_update` and `account_update`, with change history.
4. Daily and on-connect fetch of quality and limit from Meta's API.
5. Daily message counts per account.
6. Active customer query (1 message or more in 30 days).
7. Owner-only dashboard page: quality, limit, messages per day, active customers against 10.
8. Tests for the handler and the queries.
9. Test with the real number and compare with Meta.

## Later

1. Embedded Signup for customer onboarding.
2. Privacy policy and terms pages.
3. App Review videos and submission.
4. Apply for Tech Partner once the volume numbers are met.
