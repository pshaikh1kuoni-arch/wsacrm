# WhatsApp template sync troubleshooting

## ⚠️ Check this FIRST, before touching any code

**Known recurring cause:** the webhook callback URL registered in Meta
App Dashboard has, in the past, been an [ngrok](https://ngrok.com/)
tunnel link (e.g. `https://something.ngrok-free.dev/api/whatsapp/webhook`)
instead of the app's real, permanent hosted address. An ngrok link only
works while someone's computer has that exact tunnel process running —
which is most of the time *not* the case — so Meta silently fails to
deliver template status updates and nothing in wacrm ever shows an
error, because wacrm was simply never told.

**Every time template syncing seems broken, check this before anything
else:**

```
GET https://graph.facebook.com/v21.0/{app_id}/subscriptions
    ?access_token={app_id}|{app_secret}
```

Look at `data[].callback_url`. If it contains `ngrok`, `localhost`, or
any other temporary/dev address — **that is the bug, stop here.** The
fix is registering the app's real permanent URL in Meta App Dashboard
→ your app → WhatsApp → Configuration → Webhooks. It is a config
change in Meta's dashboard only; it does not touch, redeploy, or
restart wacrm.

Only move on to checking the rest of this document, or the application
code, once this has been confirmed to already point at a real,
permanent, always-on address.

---

Message templates reach wacrm's local catalog through **two independent
paths**. When a template's status looks stuck or missing in Settings →
Templates, the first question is always *which* path is broken —
they fail for completely different reasons and are fixed completely
differently.

## The two paths

| Path | How it works | When it runs | Depends on |
| --- | --- | --- | --- |
| **Webhook (push)** | Meta calls `POST {your host}/api/whatsapp/webhook` the moment a template's status/quality changes | Automatically, in real time | The webhook callback URL registered in Meta App Dashboard being a stable, always-reachable address; the `message_template_status_update` / `message_template_quality_update` fields being subscribed |
| **Sync from Meta (pull)** | wacrm calls `GET /{waba_id}/message_templates` and upserts whatever Meta returns | Only when someone clicks the button | Meta's own template **list/search index** for that WABA being complete and up to date |

The pull path was built as "the legacy fallback, intentionally
preserved" (see the comment block at the top of
`src/lib/whatsapp/template-webhook.ts`) — the push path is the
intended primary mechanism. If both are broken at once, template
status changes silently stop reaching wacrm with no error anywhere in
the app, because from wacrm's point of view nothing failed — it
simply was never told.

## Diagnosing "a template's status won't update"

Work through these in order — each one is read-only and safe to run
against the live Meta API.

### 1. Webhook callback URL — see the box at the very top of this doc

Already covered above — check it first, every time, before anything
below. In short: `data[].callback_url` must not be an ngrok/tunnel/
localhost link, and `data[].fields` must include
`message_template_status_update` and `message_template_quality_update`
(`message_template_components_update` is fine to leave off — wacrm
only logs that one, see `handleComponentsUpdate` in
`template-webhook.ts`). Re-verify when prompted after changing it —
Meta does a GET challenge (`hub.verify_token`) which wacrm checks
against the **`verify_token` column on that account's `whatsapp_config`
row** (set on Settings → WhatsApp when the account was connected —
*not* a server-wide environment variable). See
`src/app/api/whatsapp/webhook/route.ts` `GET` handler.

This is a **config check only** — it never touches the running app,
so it's always safe to run without risk of disrupting the live
service.

### 2. Is Meta's own template list actually complete?

```
GET https://graph.facebook.com/v21.0/{waba_id}/message_templates
    ?limit=100&fields=id,name,language,status
```

Compare the count/names against what you expect. If it's missing
templates you know are approved, **verify they still exist** by asking
for one directly by its known id instead of through the list:

```
GET https://graph.facebook.com/v21.0/{meta_template_id}
    ?fields=id,name,language,status,category
```

If the by-id lookup succeeds but the list omits it, the template
itself is fine — Meta's list/search index for that WABA is out of
sync with its real data. This has been observed to persist across
retries and different field combinations, and has coincided with
re-authorizing/reconnecting the WhatsApp Business Account. It is not
fixable from wacrm's side; it's a wait-and-retry situation on Meta's
end. **wacrm's sync route never deletes a local row just because Meta's
list left it out** (see the header comment in
`src/app/api/whatsapp/templates/sync/route.ts`), so an already-synced
template is never at risk of disappearing from this — only *new*
status changes on it will lag until the list heals.

### 3. Is the CRM itself reachable and pointed at the right database?

If `NEXT_PUBLIC_SITE_URL` in whatever environment is actually running
is `localhost` or otherwise not the address Meta is told about, no
webhook will ever land regardless of subscription config. Confirm the
running instance's env matches the host registered with Meta.

## What changing the webhook URL does and does not touch

Re-pointing the callback URL is a change made **inside Meta's App
Dashboard**, not in this codebase. It does not redeploy, restart, or
modify the running wacrm application in any way — the app-side webhook
handler (`src/app/api/whatsapp/webhook/route.ts` →
`src/lib/whatsapp/template-webhook.ts`) already exists and doesn't
change. The only requirement on wacrm's side is that whatever host
Meta is told about must actually be running wacrm and reachable from
the internet.

## Honesty about guarantees

Pointing the webhook at a stable host makes **future** status changes
arrive automatically and close to instantly for as long as that host
stays up and that subscription stays active. It is not a mathematical
100% guarantee — Meta can have its own transient outages, and any
webhook delivery can in principle fail — which is exactly why "Sync
from Meta" is kept as a manual fallback rather than removed. It also
does **not** retroactively fix drift that already happened before the
webhook was pointed correctly (e.g. the list-index issue in step 2
above) — that backlog needs the list to heal or a manual reconciliation
pass.

## Where the logic lives

* `src/app/api/whatsapp/webhook/route.ts` — receives every WABA
  webhook event, verifies the signature, dispatches template-field
  changes.
* `src/lib/whatsapp/template-webhook.ts` — the three template event
  handlers (status / quality / components) plus the "unknown
  template" stub-row fallback for events on templates wacrm has never
  seen locally.
* `src/app/api/whatsapp/templates/sync/route.ts` — the manual pull;
  paginates Meta's list endpoint and upserts by
  `(account_id, name, language)`.
* `src/lib/whatsapp/meta-api.ts` — `deleteMessageTemplate` /
  `submitMessageTemplate` / `editMessageTemplate`, the direct
  by-id/by-name Meta calls.
