# Deploying on Vercel

wacrm is a standard Next.js App Router project — Vercel auto-detects
it, no custom build command or config needed. This doc covers only
the wacrm-specific setup: which env vars to set, and the two things
that need attention *after* the first deploy (the webhook URL, and
scheduled tasks).

Source: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [Vercel Functions duration limits](https://vercel.com/docs/functions/configuring-functions/duration), [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 1. Push to GitHub first

Vercel deploys by importing a GitHub (or GitLab/Bitbucket) repo — make
sure everything is committed and pushed before starting the import.

## 2. Import the project

1. [vercel.com/new](https://vercel.com/new) → **Add New** → **Project**
   → **Import Git Repository** → select the repo.
2. Vercel auto-detects Next.js. Leave build/output settings on their
   defaults — nothing here needs overriding.
3. **Don't click Deploy yet** — add the environment variables first
   (step 3), or the first build will fail on missing Supabase/
   encryption vars.

## 3. Environment variables

Add these under the project's **Settings → Environment Variables**
(or in the import screen before the first deploy). Values come from
`.env.local.example` — copy the same values you're using today.

**Required** (the app won't build/run without these):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `META_APP_SECRET`

**Recommended:**
- `NEXT_PUBLIC_SITE_URL` — you won't know the final domain until after
  the first deploy (unless you're attaching a custom domain you
  already own). Deploy once, then come back and set this to the real
  domain, then redeploy. It's only used for the sitemap/OG images and
  as a fallback when no custom domain is attached yet — nothing
  breaks by leaving it blank on the first deploy.
- `NEXT_PUBLIC_APP_LOCALE`

**Optional** (only if you use the feature): `META_APP_ID` (image-header
templates), `AUTOMATION_CRON_SECRET` (see §5 below),
`WHATSAPP_TEMPLATES_DRY_RUN` (leave unset in production).

`NEXT_PUBLIC_*` vars are baked in at build time — changing one after
deploy needs a redeploy (Vercel does this automatically when you save
an env var change and choose to redeploy).

## 4. Deploy, then point the webhook at the real domain

Click **Deploy**. Once it's live you'll have a `*.vercel.app` domain
(or your attached custom domain).

Then, in **Meta for Developers → your app → WhatsApp → Configuration
→ Webhooks**, change the callback URL to:

```
https://<your-vercel-domain>/api/whatsapp/webhook
```

This is the fix for the ngrok problem covered in
`docs/whatsapp-template-sync-troubleshooting.md` — read the box at the
top of that doc before doing this step. Meta will immediately issue a
verification GET request; it's checked against the `verify_token`
stored on the relevant `whatsapp_config` row (set on Settings →
WhatsApp when the account was connected), not an env var — no action
needed here unless that value has since changed.

## 5. Scheduled tasks (only if you use Automation Wait-steps or Flows)

wacrm has two endpoints that need to be pinged periodically to drain
pending work: `GET /api/automations/cron` and `GET /api/flows/cron`.
Nothing inside the app schedules these — same as the Docker deployment
(`docs/docker.md`). They read a shared secret from the
`x-cron-secret` header, checked against `AUTOMATION_CRON_SECRET`.

**Recommended: keep using an external pinger** (e.g.
[cron-job.org](https://cron-job.org), a GitHub Actions scheduled
workflow, or any service that can set a custom header) hitting both
URLs every few minutes with `x-cron-secret: <AUTOMATION_CRON_SECRET>`.
This needs zero code changes and works identically to how it's run
today.

*Not recommended without a code change:* Vercel's own native Cron
Jobs feature (`vercel.json` → `crons`) does not send a custom header —
it sends `Authorization: Bearer <CRON_SECRET>` instead (a Vercel-
specific env var name, separate from `AUTOMATION_CRON_SECRET`). Using
it would mean either updating both cron routes to also accept that
header, or setting `AUTOMATION_CRON_SECRET` to double as `CRON_SECRET`
and changing the header check. Skip this for now — the external
pinger achieves the same result without touching the routes.

## Notes

- Function duration: the webhook route sets `maxDuration = 60`.
  Vercel's Hobby plan now includes Fluid compute by default, which
  raises the default *and* max duration to 300s — no plan upgrade
  needed for this.
- Attachment storage, database migrations, and everything else work
  exactly as documented in `docs/docker.md` — those notes aren't
  Docker-specific, they apply to any host.
