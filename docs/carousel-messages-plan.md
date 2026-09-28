# WhatsApp Carousel Messages — Implementation Plan

**Purpose of this file:** this is a resumable spec. If this conversation's
context gets closed, hand a fresh Claude session this file and it has
everything needed to pick up exactly where things left off — the decisions
already made, why they were made, the exact code touch points, and which
phases are done vs. not started. Update the status table and the phase
checklists as work lands, so the file always reflects current reality.

## Status

**Scoping & design: CLOSED.** Everything below (scope, architecture,
placement, phase breakdown) is decided and signed off. Nothing here should
be re-litigated without a new, explicit reason — implementation starts from
here.

**⚠️ Do not `git commit` or `git push` any of this work until the user
explicitly says so.** This repo auto-deploys to Vercel production on every
push, and the user does not want a production deploy per phase — only once,
after all 5 phases are done, as Phase 5's live-verification step. Keep
committing local/uncommitted between sessions; a future session reading
this file should NOT push just because a phase says "Done" below. Wait for
an explicit go-ahead.

**Implementation: IN PROGRESS (Phase 4 of 5 done).**

| Phase | Status |
|---|---|
| 1. Data & validation | **Done** |
| 2. Send + receive API | **Done** |
| 3. Builder UI | **Done** |
| 4. Flows integration | **Done** |
| 5. QA + polish | Not started |

Mark a row `In progress` / `Done` as it happens. When a phase finishes,
also add a one-line note under that phase's section below (files actually
touched, anything that changed from the plan, tests added).

## Why this exists

Triggered by a competitor teardown (a WhatsApp CRM called "Levin AI", from a
YouTube walkthrough) compared feature-for-feature against this app
(WAGenie). Carousel was the one gap the user explicitly called out as
worth building; everything else from that comparison was deferred
(round-robin fix, CTWA ad ingestion, drip campaigns, office hours, QR
generator, contact export, etc. — not tracked in this file, raise
separately if revisited).

## Scope decisions (do not re-derive these — they took real research)

**WhatsApp has two unrelated things both called "carousel."** Confirmed by
reading Meta's current Cloud API docs directly (not assumed):

1. **Interactive carousel message** — a session message, `type: "interactive"`,
   `interactive.type: "carousel"`. No Meta review. Sends instantly via the
   same `/messages` POST as any other message. Only sendable inside an
   active 24h conversation window — which a chatbot/flow reply always is.
   **This is what we are building.**
2. **Media-card carousel template** — `category: "marketing"` only, goes
   through Meta's template review queue, used for broadcast campaigns.
   **Explicitly out of scope for this round.** Lives in Settings → Templates
   if it's ever picked up later; unrelated code path from #1.

**Flows only, not Automations.** This app has two separate systems that can
send buttons/list today: the newer `Flows` engine (reactflow-based,
`src/lib/flows/`) and the older `Automations` engine
(`src/lib/automations/`, `src/components/automations/automation-builder.tsx`).
Decision: carousel ships in Flows only for this round. Automations'
`ADDABLE_STEPS` / `STEP_META` in `automation-builder.tsx` are not touched.

**No new nav/settings entry.** Confirmed by reading the actual UI: there is
no persistent left-hand "feature palette" anywhere in this app — Flows'
add-node menu and Automations' add-step menu are both dropdowns off a "+"
button, driven by a metadata registry, not sidebars. The only real left
panel is the Settings rail (`src/components/settings/settings-sections.ts`),
and carousel doesn't need a new entry there — it rides inside the existing
**Quick replies** rail section and inside **Inbox**, because both already
share one component (`InteractiveBuilder`) with Reply Buttons and List.
Adding a `carousel` kind to that one component is what makes it appear in
both places for free.

## Reference: exact Meta payload shapes

Pulled directly from Meta's current docs
(`developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-media-carousel-messages`)
so implementation doesn't need to re-fetch this.

**Constraints:**
- 2–10 cards per carousel.
- Main body text: max 1024 chars.
- Per-card body text: max 160 chars, max 2 line breaks.
- Per-card header: image or video only (no document/location on cards).
- Button types and count must be **identical across every card** — either
  one `cta_url` button, or one-or-more `quick_reply` buttons; can't mix
  per card.
- Button label max ~20 chars (interactive message constraint — tighter
  than the 25-char limit template buttons get).

**Send payload** (`POST /{phone_number_id}/messages`):

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<PHONE>",
  "type": "interactive",
  "interactive": {
    "type": "carousel",
    "body": { "text": "<MAIN BODY, max 1024 chars>" },
    "action": {
      "cards": [
        {
          "card_index": 0,
          "type": "cta_url",
          "header": { "type": "image", "image": { "link": "<URL>" } },
          "body": { "text": "<CARD BODY, max 160 chars>" },
          "action": {
            "name": "cta_url",
            "parameters": { "display_text": "<LABEL>", "url": "<URL>" }
          }
        }
      ]
    }
  }
}
```

Quick-reply variant: swap each card's `action` for
`"action": { "buttons": [{ "type": "quick_reply", "quick_reply": { "id": "<STABLE_ID>", "title": "<LABEL>" } }] }`
(1+ buttons, same type/count on every card).

Inbound webhook (card button tapped) arrives the same general shape as
today's `button_reply`/`list_reply` — needs confirming against this app's
actual webhook payload once implementation starts (Phase 2).

## Placement map (confirmed against the running app, not assumed)

| Surface | Today | Carousel change |
|---|---|---|
| Inbox composer → "+" → Interactive message dialog | `InteractiveBuilder`, toggles Buttons/List | Free — new `carousel` kind in the same component |
| Settings → Quick replies | `quick-replies-manager.tsx` embeds the same `InteractiveBuilder` | Free — same reason |
| Settings → Templates | Marketing/Utility/Auth template builder | **Untouched.** That's the Phase-2-later, out-of-scope template carousel |
| Flows → node config panel | `node-config-form.tsx` | New `send_carousel` case |
| Flows → "+ Add node" dropdown, node legend, canvas chip colors | All three read from one registry: `NODE_META` in `src/components/flows/shared.tsx` | One registry entry (icon + label + color) lights up all three automatically |
| Automations → "+ Add step" | `automation-builder.tsx`, `STEP_META`/`ADDABLE_STEPS` | **Untouched** (see scope decision above) |

A UX prototype (clickable card editor + live WhatsApp-style preview, plus
mockups of all four placements above) was built and approved:
`https://claude.ai/artifact/ATcdkXPfU9Wzbrvvf86rt1` (private artifact,
owner: pshaikh1kuoni@gmail.com). Re-read it at implementation time for the
exact visual target — card thumbnail strip, per-card header type toggle,
carousel-wide button-type toggle, phone-style preview, dot pagination.

## Phase 1 — Data & validation

**Goal:** teach the codebase what a carousel payload is and what makes one
valid, with no UI or send capability yet.

- `src/lib/whatsapp/interactive.ts` — add a `carousel` member to the
  `InteractiveMessagePayload` discriminated union: main `body`, `cards:
  Array<{ header: { type: 'image'|'video'; url: string }; body?: string;
  }>`, plus a carousel-level `button_mode: 'url' | 'quick_reply'` and,
  per card, either `{ button_label, button_url }` or `{ button_label,
  reply_id, next_node_key? }` depending on mode.
- Extend `validateInteractivePayload` (same file) with the constraints
  listed above: 2–10 cards, per-card body ≤160 chars/2 lines, main body
  ≤1024, button label length, and — importantly — that every card's
  button configuration matches the carousel-level `button_mode` (this is
  the one Meta rejects silently-wrong payloads for most often).
- Mirror whatever `INTERACTIVE_LIMITS` constant shape `buttons`/`list`
  already use in `meta-api.ts`, so the builder (Phase 3) can read limits
  from one place same as today.

**Notes — done 2026-09-28:**
- Shape landed slightly differently than the placeholder sketch above: one
  button per card (`button_label` + `button_url` *or* `button_id`,
  depending on the carousel-level `button_mode`), not two — matches what
  the approved mockup actually shows. `next_node_key` for quick-reply
  routing is deferred to Phase 4 (Flows), not added to the base payload
  type — it's a flow-node concern, not an interactive-message concern.
- `INTERACTIVE_LIMITS` (meta-api.ts) gained `minCarouselCards: 2`,
  `maxCarouselCards: 10`, `carouselCardBodyMaxLength: 160`. Card button
  label reuses the existing `buttonTitleMaxLength: 20` — Meta caps both
  at the same 20 chars, confirmed against the docs pulled during
  scoping.
- **Important discovery, feeds into Phase 2:** widening the
  `InteractiveMessagePayload` union to 3 members broke compilation in
  four places that assumed a binary buttons/list shape:
  `interactive-builder.tsx`, `interactive-preview.tsx`,
  `automations/meta-send.ts`, and `whatsapp/send-message.ts`. Fixed all
  four for Phase 1 (builder/preview show a "not available yet" stub for
  carousel; both send paths now throw a clear, honest error instead of
  silently mis-sending a carousel payload as a list). **Phase 2 must
  replace the throw in `whatsapp/send-message.ts` with a real
  `sendInteractiveCarousel` call** — this is the actual send path the
  Inbox composer and Quick Replies use, not just `meta-api.ts` in
  isolation. `automations/meta-send.ts`'s throw stays permanent — that's
  the Flows-only scope decision, not a TODO.
- Full `tsc --noEmit` clean, full test suite green (1054 tests), 8 new
  carousel validation tests added to `interactive.test.ts` (22 total in
  that file now).

## Phase 2 — Send + receive API

**Goal:** the backend can actually send a carousel and understands a
customer tapping a card button.

- `src/lib/whatsapp/meta-api.ts` — add `sendInteractiveCarousel`, mirroring
  `sendInteractiveButtons`/`sendInteractiveList` exactly (same
  `META_API_BASE` POST, same `throwMetaError` handling, same
  `MetaSendResult` return shape). Build the `interactive.action.cards`
  array from validated payload per the reference shape above.
- `src/lib/whatsapp/send-message.ts` (~line 370–397) — replace the
  Phase-1 `throw new Error('Carousel messages cannot be sent yet.')`
  with a real `p.kind === 'carousel'` branch calling
  `sendInteractiveCarousel`. This is the shared send-and-persist core
  Inbox and Quick Replies actually call — without this, the UI in Phase
  3 would build a working editor with no way to actually send.
- ~~Find and extend the inbound webhook handler...~~ **Not needed —
  confirmed done, see notes below.**

**Notes — done 2026-09-28:**
- `sendInteractiveCarousel` added to `meta-api.ts` (right after
  `sendInteractiveList`), same shape/validation/error-throwing pattern as
  the other two interactive senders. Card wrapper `type` is always
  `'cta_url'` even for quick-reply cards — verified against Meta's own
  example payloads (both button variants), not a guess.
- `send-message.ts` (`src/app/api/whatsapp/webhook/route.ts`'s sibling —
  the actual shared send-and-persist core at ~line 370) now has a real
  `sendInteractiveCarousel` call in place of the Phase-1 throw. This is
  the path Inbox and Quick Replies will hit once Phase 3 ships the UI.
- **Webhook: confirmed no changes needed**, resolving the open question
  from the original Phase-2 sketch above. Read Meta's actual webhook
  reference doc
  (`webhooks/reference/messages/interactive.md`) — it documents exactly
  two inbound interactive reply shapes, `button_reply` and `list_reply`,
  with no carousel-specific variant and no `card_index` field anywhere.
  A quick-reply tap on a carousel card arrives as an ordinary
  `interactive.button_reply.id` webhook, identical to a tap on a plain
  Reply Buttons message — `src/app/api/whatsapp/webhook/route.ts`
  already captures this into `interactiveReplyId` today with zero
  changes needed. **This also answers the `card_index` question for
  Phase 4:** routing only needs the tapped button's own id (must stay
  unique per carousel, already enforced by Phase 1's validation) — no
  card_index correlation required, same as `send_buttons` today.
- Added `sendInteractiveCarousel` test coverage: 8 new cases in
  `meta-api.test.ts` (validation + exact payload shape for both
  url-mode and quick_reply-mode), plus one param-validation case in
  `send-message.test.ts` proving the carousel branch of
  `validateInteractivePayload` is actually wired into the send dispatch,
  not just exercised in isolation.
- Full suite: 1062/1062 passing (was 1054 after Phase 1), `tsc --noEmit`
  clean.

## Phase 3 — Builder UI

**Goal:** an agent can build and send a carousel from Inbox or save one as
a Quick Reply. This is the UI already approved in the mockup.

- `src/components/interactive/interactive-builder.tsx` — add
  `blankCarouselPayload()`, a third `KindButton` ("Carousel") next to
  Reply Buttons/List, and a `CarouselEditor` sub-component: card
  thumbnail strip (add/remove/reorder, 2–10), carousel-wide button-type
  toggle, and a detail panel for the selected card (header type
  image/video + upload, body textarea with counter, button label +
  url/reply-id fields depending on mode).
- `src/components/interactive/interactive-preview.tsx` — add a `carousel`
  branch: horizontal scroll of mini cards (image/video placeholder, body
  text, button pill) + dot pagination, matching the phone-style chrome
  the existing buttons/list preview already uses.
- No changes needed in `message-composer.tsx` or
  `quick-replies-manager.tsx` — both already embed `InteractiveBuilder`
  generically and will pick up the new kind automatically. Smoke-test
  both after this phase anyway.
- Inbox message bubble (`message-bubble.tsx` / wherever
  `InteractivePreview` renders a *sent* message) should already handle a
  carousel payload once `InteractivePreview` does — verify, don't assume.

**Notes — done 2026-09-28:**
- Shipped as designed: a third "Carousel" `KindButton`, `switchKind`
  extended to 3-way, `blankCarouselPayload()` (seeds 2 cards — Meta's
  minimum, same pattern as the other two factories seeding their kind's
  minimum). `CarouselEditor` has a card thumbnail strip (click to
  select, hover-delete, "+" to add, capped 2–10), a carousel-wide
  button-type toggle (url / quick_reply — modeled once, not per-card, so
  Meta's "must match across all cards" rule is structurally impossible
  to violate from this UI), and a detail panel for the selected card
  only (header type toggle + file upload, body textarea, button
  label + url-or-id depending on mode). Card ids for quick_reply mode
  auto-generate (`card_N`) and are only exposed for manual editing
  behind the existing "advanced" toggle, same convention as button/row
  ids elsewhere in this file.
- **Media upload reuses existing infrastructure, nothing new built:**
  `uploadAccountMedia()` from `@/lib/storage/upload-media` against the
  same `flow-media` Supabase Storage bucket Flows' `send_media` node
  already uploads to — same account-scoped path convention, same 16 MB
  client-side ceiling. Chose `flow-media` over the inbox composer's
  `chat-media` bucket deliberately: a carousel card is reusable content
  saved with a quick reply (or, in Phase 4, a flow node), not a one-off
  chat attachment.
- `InteractivePreview` carousel branch: horizontal scroll of mini cards
  (real `<img>`/`<video>` once a header URL exists, an icon placeholder
  before upload) + dot pagination. This is the ONLY place carousel
  rendering logic lives — the inbox message bubble already calls this
  component generically for any `content_type: 'interactive'` message,
  confirmed by reading `message-bubble.tsx` (not assumed), so it needed
  no changes at all.
- Confirmed (by reading the actual code, not assuming) that
  `message-composer.tsx` and `quick-replies-manager.tsx` needed zero
  changes — neither branches on the buttons/list/carousel discriminant;
  both pass `InteractiveMessagePayload` through generically. Their own
  `.kind` usages are unrelated discriminants (`QuickReplyKind`,
  `ComposerMediaKind`).
- **Deviated from the plan on translations — for the better, not a
  shortcut.** The original Phase 5 sketch planned to stub Phase 3/4
  strings and translate everything at the end. Once actually at the
  keyboard: `messages/es.json`, `ko.json`, `pt.json` are fully,
  genuinely translated today (not English placeholders), and there's a
  CI-enforced test (`src/i18n/messages.test.ts`) requiring exact key +
  ICU-placeholder parity across all four locale files — so English-only
  keys would have failed the suite immediately, not just looked
  unfinished. Wrote real es/ko/pt translations for all 22 new
  `Interactive.*` keys now, matching each file's existing tone. Phase 5
  no longer needs to translate anything from Phase 3 — only Phase 4's
  new `nodes.send_carousel.*` keys remain.
- **Verification is compile-level only, not click-through.** Ran
  `tsc --noEmit` (clean), full `vitest` suite (1062/1062, includes the
  i18n parity + ICU-signature tests), and `eslint` (clean) after every
  change. Also booted `next dev` and confirmed the app compiles with no
  runtime errors. Did **not** log in and click through the actual
  Carousel tab in a browser — the carousel UI lives behind authenticated
  routes (Inbox, Settings → Quick replies) in this repo's real Supabase
  project, and doing that would mean either using real login credentials
  I wasn't given or creating test data in the user's live backend
  without asking first. **A real click-through (open Inbox → "+" →
  Interactive message → Carousel tab, or Settings → Quick replies → New)
  is still worth doing by hand before this ships.**
- This phase also surfaced a real design gap for Phase 4 to resolve,
  not solve now: `CarouselEditor` edits the base
  `InteractiveCarouselPayload` (from `interactive.ts`), which has no
  `next_node_key` field — that's a Flows-only concept, same as how
  `SendButtonsNodeConfig.buttons[]` extends the base `InteractiveButton`
  shape with one. Phase 4's node-config-form can't drop in
  `<CarouselEditor>` completely unmodified the way this file's plan
  sketch implied; it'll need each card's quick-reply id paired with a
  `next_node_key` picker, the same shape problem `send_buttons`/
  `send_list` already solved once — follow that pattern, don't
  re-invent it.

## Phase 4 — Flows integration

**Goal:** a flow can send a carousel as an automated reply, and a tapped
card button advances the flow correctly.

- `src/lib/flows/types.ts` — add `SendCarouselNodeConfig` (same payload
  shape as Phase 1, plus per-card `next_node_key` for quick-reply mode,
  mirroring how `SendButtonsNodeConfig` maps button taps to next nodes)
  and add `{ node_type: "send_carousel"; config: SendCarouselNodeConfig
  }` to the `FlowNodeConfig` union.
- `src/components/flows/shared.tsx` — register `send_carousel` in
  `NODE_META` (icon, label key, color in `nodeColors`). This alone
  surfaces it in the "+ Add node" dropdown, the node-type legend
  popover, and the canvas node chip — all three read this one registry.
- `src/components/flows/forms/node-config-form.tsx` — new case. Cannot
  drop `<CarouselEditor>` in completely unmodified — see Phase 3's notes
  above: each card's quick-reply id needs a paired `next_node_key`
  picker, the same problem `send_buttons`/`send_list` already solved
  once. Follow that existing pattern rather than re-deriving it.
- Flow engine (wherever `send_buttons`/`send_list` node types get
  executed and wherever their button/list-item taps get routed to
  `next_node_key` — locate the exact runner file at implementation
  time) — add `send_carousel` execution (calls
  `sendInteractiveCarousel` from Phase 2) and card-button-tap routing
  using Phase 2's webhook parsing.
- Add translation keys for `nodes.send_carousel.label` /
  `.blurb` alongside the existing node-type strings.

**Notes — done 2026-09-28:**
- **This phase turned out much bigger than the 4-bullet sketch above
  implied.** `FlowNodeType`/`NodeType` is a discriminated union
  threaded through ~10 files, most of it enforced only by *some*
  TypeScript switches (not all — this codebase's `tsconfig.json` has
  `strict: true` but not `noImplicitReturns`, so a chunk of these
  switches compile cleanly even when missing a case and silently
  return `undefined` at runtime instead of erroring at build time).
  Concretely touched, beyond the 4 files sketched: `flow-editor-state.tsx`
  (`defaultConfigFor` — seeds a blank node), `edges.ts` (all 4
  functions: `deriveCanvasEdges`, `outgoingSlots`, `applyEdgeConnection`,
  `unlinkNodeReferences` — canvas arrow rendering, drag-to-connect, and
  delete-node cleanup), `validate.ts` (both the main per-node validation
  switch AND the separate `outgoingEdges` reachability helper),
  `flow-builder.tsx` + `flow-canvas.tsx` (the two duplicate "+ Add node"
  type lists, plus `hasReplyIds` gating the advanced-ids toggle). A
  future node type add should budget for this same footprint, not just
  types.ts + shared.tsx + the config form + the engine.
- **Key design decision: `send_carousel` is dual-mode, and that
  propagates everywhere.** `button_mode: 'url'` behaves like
  `send_media`/`send_template` (fire, auto-advance on one node-level
  `next_node_key` — a url button tap opens a link client-side and
  Meta never sends a webhook for it, so there's nothing to route on).
  `button_mode: 'quick_reply'` behaves like `send_buttons`/`send_list`
  (suspend, route per-card on that card's own `next_node_key`, resume
  on a tap). Every one of the ~10 touched files has this same if/else
  fork inside its `send_carousel` case. `isAutoAdvancing`/`isSuspending`
  in engine.ts (previously pure `node_type: string → boolean`
  classifiers) gained an optional second `config` parameter so they can
  actually tell the two modes apart — every other node type ignores it.
- Canvas `sourceHandle` scheme for carousel, matching the existing
  `button:<reply_id>` / `row:<reply_id>` convention: `next` in url mode
  (single edge, like send_media), `card:<reply_id>` per card in
  quick_reply mode.
- `src/lib/flows/meta-send.ts` (Flows' own Meta sender, separate from
  `automations/meta-send.ts`) needed a new `engineSendInteractiveCarousel`
  — not called out in the original sketch, which only mentioned "the
  engine." This is the function `sendCarouselAndSuspend` (the new node
  executor in `engine.ts`) actually calls.
- **Deliberately out of scope, not forgotten:**
  - `src/lib/flows/templates.ts` (the 3 pre-built starter flows a user
    can clone) — its `FlowTemplateNodeType` is its own deliberately
    narrower union, separate from `FlowNodeType`, so leaving carousel
    out doesn't break anything. No carousel starter template was added;
    revisit only if wanted as UX polish later.
  - A deep engine-level integration test mirroring `engine.test.ts`'s
    `BUTTONS_NODE`/`LIST_NODE`/`nodesEndingIn()` fixture (which
    specifically proves `{{vars.x}}` interpolation end-to-end through
    `dispatchInboundToFlows`) was **not** built for carousel. Covered
    instead, at what seemed like the right depth for the remaining
    effort: `matchReplyId` behavior, the `isAutoAdvancing`/`isSuspending`
    dual-mode classification, and full `validate.ts` +
    `edges.ts` coverage for both modes. The interpolation mechanism
    itself (`interpolateVars`/`interpolateOptionalVars`) is shared
    code already proven correct by the existing buttons/list fixture —
    `sendCarouselAndSuspend` calls the exact same two functions, it
    doesn't reimplement them.
- Full suite: 1079/1079 passing (was 1062 after Phase 3 — 17 new tests
  across `engine.test.ts`, `edges.test.ts`, `validate.test.ts`),
  `tsc --noEmit` clean, `eslint` clean on every touched file (the 6
  warnings `eslint` reports in `src/components/flows/` all pre-date this
  work — confirmed by running eslint against `git stash`, verbatim same
  warnings on `main`). `next dev` boots and serves `/login` with no
  compile errors — same caveat as Phase 3: no authenticated click-through
  was done.

## Phase 5 — QA + polish

**Translations and most unit-level test coverage are already done** —
Phases 3 and 4 did them inline rather than deferring (see their notes;
this was a deliberate deviation from the original phase sketch, made
because this repo enforces translation-catalogue parity in CI and
because leaving obvious gaps untested while moving on felt worse than
the extra time). What's actually left:

- **The manual browser click-through — the one thing no phase so far
  has done.** Every phase's verification has been compile-level only
  (`tsc --noEmit`, `vitest`, `eslint`, `next dev` boots) because doing
  more meant either real login credentials this session wasn't given,
  or creating data in the user's live Supabase project without asking.
  Now that all the code exists, actually open the app and:
  - Inbox → "+" → Interactive message → Carousel tab: build one, send
    it to a real test number, confirm the phone renders it as designed.
  - Settings → Quick replies → New → Carousel: save one, confirm it
    reappears correctly on reopen (round-trips through the DB).
  - Flows → add a Send Carousel node in **url mode**: confirm it sends
    and the run auto-advances with no suspend.
  - Flows → add a Send Carousel node in **quick_reply mode**: confirm
    it suspends, tap a card on the test number, confirm the run routes
    to that card's next node (this is the one path with real webhook
    involvement — the part most likely to reveal something the
    reasoning in Phase 2's notes got wrong about Meta's actual payload
    shape).
- Re-open the approved mockup
  (`https://claude.ai/artifact/ATcdkXPfU9Wzbrvvf86rt1`) once and diff
  the shipped UI against it — flag any deliberate deviations here rather
  than silently drifting from what was signed off.
- This is also **Phase 5's other job per the Status section at the top
  of this file: the actual `git commit` + `git push` + live Vercel
  check**, which every phase before this one has deliberately withheld.
  Only do this once the user gives an explicit go-ahead — reaching
  Phase 5 is not itself that signal.

_Notes once done: ____
