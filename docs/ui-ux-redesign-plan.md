# UI/UX Redesign — Implementation Strategy

Reference mockup: [wacrm Redesign — Hybrid Warm SaaS](https://claude.ai/artifact/Fp2F6Hc4ZpsVUMiUJ5YMsP) (4 artboards: Dashboard, Inbox, Components & states, Light vs dark).

## 1. What we're building

- **Floating panels, no ruled dividers.** Every distinct block (sidebar, header controls, each card) is its own rounded, shadowed shape sitting on a neutral gray/near-black canvas with real gaps between pieces. Separation comes from spacing + elevation, never a 1px border line.
- **A two-stop gradient accent system**, not a flat single color. Each of the app's existing 5 accent presets (violet / emerald / cobalt / amber / rose) gets a paired second hue (e.g. violet → cyan) used sparingly — logo mark, active nav item, hero KPI tile, primary buttons, outgoing chat bubbles. Everything else stays neutral, so color still carries meaning instead of decorating everything.
- **Full light/dark parity.** Both modes ship together, same philosophy, verified side by side — this isn't a "dark mode afterthought."

## 2. Foundation layer (must land before anything else)

Everything downstream depends on this, so it's the first and highest-leverage phase.

| File | Change |
|---|---|
| `src/app/globals.css` | Add `--canvas` (page backdrop, distinct from `--card`), `--card-2`, `--shadow` / `--shadow-sm` elevation tokens, per-mode neutral scale tuned so panels sit visibly lighter (dark mode) / whiter (light mode) than the canvas behind them. Reuse the already-defined-but-unused `--radius-2xl/3xl/4xl` tokens for the new card radius instead of introducing new ones. |
| `src/lib/themes.ts` | Add a second gradient-stop hex per `ThemeId` (the `--accent-2` pairing) alongside the existing swatch/name/tagline metadata already read by `AppearancePanel`. |
| `src/components/ui/card.tsx`, `button.tsx`, `badge.tsx` (shadcn primitives) | Drop the `border` + hairline treatment in favor of `shadow` + larger radius; add a `gradient` variant to `Button`/`Card` that reads `--accent`/`--accent-2`. |
| `src/hooks/use-theme.ts` / boot script in `layout.tsx` | No behavioral change — mode/accent are still a single attribute swap on `<html>`, persisted the same way. We're only adding tokens under the existing `data-mode` / `data-theme` mechanism, not replacing it. |

Once this lands, most feature pages inherit the new look for free just by using the updated primitives — that's why it's phase 0, not phase 3.

## 3. Phased rollout

**Phase 1 — App shell — ✅ Complete**
`src/components/layout/sidebar.tsx`, `header.tsx`, `mode-toggle.tsx`, `src/app/(dashboard)/dashboard-shell.tsx`
Sidebar becomes one floating card (logo → workspace switcher → nav → Agent Copilot dock → profile, no internal dividers). Header controls (search, notification bell, primary action) become individually floating pills directly on the canvas. This is the highest-visibility change and sets the tone for every other screen, so it goes first.

**Phase 2 — Dashboard — ✅ Complete**
`src/components/dashboard/*` (`metric-card`, `pipeline-donut`, `activity-feed`, `quick-actions`, `response-time-chart`, `conversations-chart`, `skeleton`)
Convert metric tiles to the floating KPI-tile pattern (one gradient "hero" tile + neutral tiles), apply the same card treatment to the pipeline/activity/chart cards. Lower interaction complexity than Inbox, so it's the first real screen we ship — a good checkpoint before tackling the harder one.
Shipped as: opaque `bg-card`/`bg-card-2` + `shadow-card` across all dashboard cards (metric tiles, quick actions, charts, activity feed, pipeline donut, skeletons), with translucent-fill regressions fixed along the way on Contacts/Notifications/Pipelines/Automations/Settings. KPI tiles are click-to-select toggles (`highlightedMetric` state in `dashboard/page.tsx`) — clicking a tile makes it the one gradient "hero" tile; selection is purely a visual "what am I looking at" indicator and does not filter or re-scope any other widget on the page.

**Phase 3 — Inbox — ✅ Complete**
`src/components/inbox/*` (`conversation-list`, `message-thread`, `message-bubble`, `message-composer`, `contact-sidebar`, `ai-thread-banner`, `quick-reply-picker`, `template-picker`)
Three-pane layout (conversation list / thread / contact panel) becomes three separate floating cards with gaps instead of a bordered single strip. Gradient applies to outgoing bubbles and the AI draft state. This is the most complex, most-used screen, so it's deliberately not first — the shell and Dashboard phases work out the token/shadow/gradient kinks on lower-risk surfaces first.
Shipped as: conversation-list, message-thread, and contact-sidebar each became their own `rounded-2xl`/`shadow-card` floating panel with a `gap-4` between them (desktop only — mobile stays flush edge-to-edge, one pane at a time, matching the Phase 1 sidebar-drawer precedent). Internal dividers (search header, thread header/composer borders, contact panel's Tags/Deals/Notes rules) were left in place. Also fixed a latent height bug (page used a hardcoded `calc(100vh-3.5rem)` that didn't account for Phase 1's `lg:gap-4` between header and main — switched to `lg:h-full`) and a header overlap where the long "No customer messages" session-status pill collided with the refresh/Open/Assign buttons — the header now wraps onto a second line instead of overlapping when that text is long.

**Phase 4 — Remaining pages — ✅ Complete**
`contacts/`, `pipelines/` (kanban board + deal cards), `broadcasts/` (4-step wizard), `automations/`, `flows/` (canvas + editor shell), `agents/`, `settings/*`, `notifications/`
Most of these inherit the look automatically once Phase 0's primitives update. What needs deliberate attention: `pipeline-board.tsx` (kanban columns as floating panels), `flow-canvas.tsx` (canvas background vs. floating node cards), and the `broadcasts` step wizard (progress indicator styling). Settings' own `appearance-panel.tsx` also needs its swatches updated to preview the new gradient pairs, not flat circles.
Shipped as: a full audit (every remaining route + component) found and converted every leftover bordered/translucent panel to the opaque `bg-card`/`bg-card-2` + `shadow-card` pattern — bulk-action bars, nested list/detail panels, dialog sub-panels, the whole broadcast wizard (each step now sits inside one floating card, so each step's own Back/Next divider became a legitimate internal footer border instead of a stray line), automation/flow node cards (colored left-accent bars replace `border-l-4`, matching the existing `DealCard` convention; idle-state hairline borders dropped in favor of shadow, while hover/selected/error/flash states keep their functional colored borders/rings), and the Settings appearance-panel swatches (now a real two-stop gradient built from each theme's `swatch`/`swatch2`, not a flat circle). Deliberately left alone: the broadcast wizard's 3-state step-progress badges (a functional sequence indicator, not a panel boundary), all colored semantic alert banners, Sheet's built-in edge border (a systemic component-level decision, out of scope here), and inert `border-border` classes on Dialog/DropdownMenu content that render no visible border today (pure code-hygiene, zero visual difference).

**Phase 5 — Cross-cutting QA**
- Contrast check every semantic color (risk badges, success/warning text) against both canvas tones, across all 5 accent presets — not just the default.
- Mobile drawer sidebar (`open`/`onClose` props in `sidebar.tsx`) — confirm the floating-card treatment still works at the drawer width, or define a flatter mobile fallback if the padding/gaps feel cramped under ~380px.
- Browser support check for `color-mix()` and `conic-gradient()` (both used in the mockup's active-states and SLA gauge) against whatever browser matrix the product actually needs to support.
- Perf sanity on the conversation list and any long tables — shadows/gradients are cheap, but worth a pass if virtualization isn't already in place.

## 4. Explicitly out of scope

No change to data fetching, business logic, API routes, auth, i18n key structure, or the `data-mode`/`data-theme` persistence mechanism itself. This is a visual/layout-layer change only.

## 5. Open decisions before we start cutting code

1. **Default accent/gradient pairing** — ship violet→cyan as the new default, or pick a different pair from the 5 presets?
2. **Mobile behavior** — carry the floating-panel padding straight to mobile widths, or design a flatter fallback below a breakpoint?
3. **Browser floor** — confirm `color-mix()` / `conic-gradient()` support is acceptable for the product's actual supported browser list.

No effort/time estimates here — those depend on team size and how much of Phase 0 turns out to be mechanical vs. requires new variants, which is easier to size once we're actually in the code.
