// ============================================================
// Interactive message payload — shared shape + validation.
//
// The persisted, round-trippable representation of a WhatsApp
// interactive message (reply buttons or a list). This is the single
// source of truth used by:
//   - the inbox composer + automation "send interactive" builders,
//   - the send-message core + automation engine (send + persist),
//   - the message bubble + preview (render),
//   - quick replies (store an interactive snippet).
//
// The field names (`id`/`title`/`description` on buttons/rows) match
// `meta-api.ts`'s `InteractiveButton` / `InteractiveListRow` /
// `InteractiveListSection` on purpose, so a payload maps straight onto
// the Meta send args with no translation.
//
// `validateInteractivePayload` mirrors the throws already inside the
// meta-api senders, but returns a result object so callers (API routes,
// activation checks) can surface a clean error to the user *before* the
// network call rather than turning a bad payload into a 400 from Meta
// mid-conversation.
// ============================================================

import { INTERACTIVE_LIMITS } from './meta-api'

export interface InteractiveButton {
  /** Stable id echoed back in the webhook when tapped. */
  id: string
  /** Visible label (≤ 20 chars per Meta). */
  title: string
}

export interface InteractiveButtonsPayload {
  kind: 'buttons'
  /** Body text shown above the buttons (≤ 1024 chars). */
  body: string
  /** Optional plain-text header (≤ 60 chars). */
  header?: string
  /** Optional grey footer line (≤ 60 chars). */
  footer?: string
  /** 1–3 buttons. */
  buttons: InteractiveButton[]
}

export interface InteractiveListRow {
  /** Stable id echoed back in the webhook when selected. */
  id: string
  /** Row title (≤ 24 chars per Meta). */
  title: string
  /** Optional secondary line (≤ 72 chars). */
  description?: string
}

export interface InteractiveListSection {
  /** Optional section header shown above its rows. */
  title?: string
  rows: InteractiveListRow[]
}

export interface InteractiveListPayload {
  kind: 'list'
  body: string
  header?: string
  footer?: string
  /** Label of the tap-to-expand button on the message bubble (≤ 20 chars). */
  button_label: string
  /** 1–10 rows TOTAL across all sections. */
  sections: InteractiveListSection[]
}

export interface InteractiveCarouselCardHeader {
  /** Cards only support media headers — no text/document/location. */
  type: 'image' | 'video'
  /** Public URL Meta will fetch. */
  url: string
}

export interface InteractiveCarouselCard {
  header: InteractiveCarouselCardHeader
  /** Optional card text (≤ 160 chars, ≤ 2 line breaks per Meta). */
  body?: string
  /** Visible label on the card's button (≤ 20 chars per Meta). */
  button_label: string
  /** Set when the carousel's `button_mode` is `'url'`. */
  button_url?: string
  /** Set when `button_mode` is `'quick_reply'` — echoed back in the
   *  webhook when tapped, same role as `InteractiveButton.id` above. */
  button_id?: string
}

export interface InteractiveCarouselPayload {
  kind: 'carousel'
  /** Main message text shown above the cards (≤ 1024 chars). */
  body: string
  /**
   * Meta requires every card in a carousel to use the same button type
   * — modeling it once here (rather than per-card) makes mixing types
   * structurally impossible instead of a validation rule to remember.
   */
  button_mode: 'url' | 'quick_reply'
  /** 2–10 cards. */
  cards: InteractiveCarouselCard[]
}

export type InteractiveMessagePayload =
  | InteractiveButtonsPayload
  | InteractiveListPayload
  | InteractiveCarouselPayload

export type InteractiveValidation =
  | { ok: true }
  | { ok: false; error: string }

function ok(): InteractiveValidation {
  return { ok: true }
}
function fail(error: string): InteractiveValidation {
  return { ok: false, error }
}

function validateHeaderFooter(
  header: string | undefined,
  footer: string | undefined,
): InteractiveValidation {
  if (header && header.length > INTERACTIVE_LIMITS.headerTextMaxLength) {
    return fail(
      `Header exceeds the ${INTERACTIVE_LIMITS.headerTextMaxLength}-character limit.`,
    )
  }
  if (footer && footer.length > INTERACTIVE_LIMITS.footerMaxLength) {
    return fail(
      `Footer exceeds the ${INTERACTIVE_LIMITS.footerMaxLength}-character limit.`,
    )
  }
  return ok()
}

/**
 * Validate an interactive payload against Meta's hard limits + our
 * structural rules (non-empty ids/titles, unique ids). Returns a result
 * object rather than throwing so API routes can map it to a 400 with a
 * user-facing message.
 *
 * `unknown` in, narrowed here, so it's safe to call straight on a parsed
 * request body.
 */
export function validateInteractivePayload(
  payload: unknown,
): InteractiveValidation {
  if (!payload || typeof payload !== 'object') {
    return fail('Interactive message payload is required.')
  }
  const p = payload as Partial<InteractiveMessagePayload>

  if (typeof p.body !== 'string' || p.body.trim() === '') {
    return fail('Interactive message body text is required.')
  }
  if (p.body.length > INTERACTIVE_LIMITS.bodyMaxLength) {
    return fail(
      `Body text exceeds the ${INTERACTIVE_LIMITS.bodyMaxLength}-character limit.`,
    )
  }
  // Header/footer only exist on buttons/list — a carousel message has
  // neither field in Meta's payload shape, so the check is scoped to
  // the two kinds that do rather than read off the shared `p`.
  if (p.kind === 'buttons' || p.kind === 'list') {
    const hf = validateHeaderFooter(p.header, p.footer)
    if (!hf.ok) return hf
  }

  if (p.kind === 'buttons') {
    const buttons = (p as InteractiveButtonsPayload).buttons
    if (!Array.isArray(buttons) || buttons.length < 1) {
      return fail('Add at least one reply button.')
    }
    if (buttons.length > INTERACTIVE_LIMITS.maxButtons) {
      return fail(
        `A reply-button message allows at most ${INTERACTIVE_LIMITS.maxButtons} buttons.`,
      )
    }
    const seen = new Set<string>()
    for (const b of buttons) {
      if (!b || typeof b.id !== 'string' || b.id.trim() === '') {
        return fail('Every button needs an id.')
      }
      if (seen.has(b.id)) {
        return fail(`Duplicate button id "${b.id}".`)
      }
      seen.add(b.id)
      if (typeof b.title !== 'string' || b.title.trim() === '') {
        return fail('Every button needs a label.')
      }
      if (b.title.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
        return fail(
          `Button label "${b.title}" exceeds the ${INTERACTIVE_LIMITS.buttonTitleMaxLength}-character limit.`,
        )
      }
    }
    return ok()
  }

  if (p.kind === 'list') {
    const list = p as InteractiveListPayload
    if (
      typeof list.button_label !== 'string' ||
      list.button_label.trim() === ''
    ) {
      return fail('The list needs a button label.')
    }
    if (list.button_label.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
      return fail(
        `List button label exceeds the ${INTERACTIVE_LIMITS.buttonTitleMaxLength}-character limit.`,
      )
    }
    if (!Array.isArray(list.sections) || list.sections.length < 1) {
      return fail('Add at least one list section.')
    }
    if (list.sections.length > INTERACTIVE_LIMITS.maxListSections) {
      return fail(
        `A list allows at most ${INTERACTIVE_LIMITS.maxListSections} sections.`,
      )
    }
    const seen = new Set<string>()
    let total = 0
    for (const section of list.sections) {
      if (!section || !Array.isArray(section.rows)) {
        return fail('Every list section needs rows.')
      }
      for (const row of section.rows) {
        total++
        if (!row || typeof row.id !== 'string' || row.id.trim() === '') {
          return fail('Every list row needs an id.')
        }
        if (seen.has(row.id)) {
          return fail(`Duplicate list row id "${row.id}".`)
        }
        seen.add(row.id)
        if (typeof row.title !== 'string' || row.title.trim() === '') {
          return fail('Every list row needs a title.')
        }
        if (row.title.length > INTERACTIVE_LIMITS.listRowTitleMaxLength) {
          return fail(
            `List row title "${row.title}" exceeds the ${INTERACTIVE_LIMITS.listRowTitleMaxLength}-character limit.`,
          )
        }
        if (
          row.description &&
          row.description.length >
            INTERACTIVE_LIMITS.listRowDescriptionMaxLength
        ) {
          return fail(
            `List row description exceeds the ${INTERACTIVE_LIMITS.listRowDescriptionMaxLength}-character limit.`,
          )
        }
      }
    }
    if (total < 1) return fail('Add at least one list row.')
    if (total > INTERACTIVE_LIMITS.maxListRowsTotal) {
      return fail(
        `A list allows at most ${INTERACTIVE_LIMITS.maxListRowsTotal} rows in total.`,
      )
    }
    return ok()
  }

  if (p.kind === 'carousel') {
    const carousel = p as InteractiveCarouselPayload
    const cards = carousel.cards
    if (!Array.isArray(cards) || cards.length < INTERACTIVE_LIMITS.minCarouselCards) {
      return fail(`A carousel needs at least ${INTERACTIVE_LIMITS.minCarouselCards} cards.`)
    }
    if (cards.length > INTERACTIVE_LIMITS.maxCarouselCards) {
      return fail(`A carousel allows at most ${INTERACTIVE_LIMITS.maxCarouselCards} cards.`)
    }
    if (carousel.button_mode !== 'url' && carousel.button_mode !== 'quick_reply') {
      return fail('Choose a button type for the carousel.')
    }
    const seenButtonIds = new Set<string>()
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      const n = i + 1
      if (!card || (card.header?.type !== 'image' && card.header?.type !== 'video')) {
        return fail(`Card ${n} needs an image or video header.`)
      }
      if (typeof card.header.url !== 'string' || card.header.url.trim() === '') {
        return fail(`Card ${n} is missing its header media.`)
      }
      if (
        card.body &&
        card.body.length > INTERACTIVE_LIMITS.carouselCardBodyMaxLength
      ) {
        return fail(
          `Card ${n} text exceeds the ${INTERACTIVE_LIMITS.carouselCardBodyMaxLength}-character limit.`,
        )
      }
      if (typeof card.button_label !== 'string' || card.button_label.trim() === '') {
        return fail(`Card ${n} needs a button label.`)
      }
      if (card.button_label.length > INTERACTIVE_LIMITS.buttonTitleMaxLength) {
        return fail(
          `Card ${n} button label exceeds the ${INTERACTIVE_LIMITS.buttonTitleMaxLength}-character limit.`,
        )
      }
      if (carousel.button_mode === 'url') {
        if (typeof card.button_url !== 'string' || card.button_url.trim() === '') {
          return fail(`Card ${n} needs a destination URL.`)
        }
      } else {
        if (typeof card.button_id !== 'string' || card.button_id.trim() === '') {
          return fail(`Card ${n} button is missing an id.`)
        }
        if (seenButtonIds.has(card.button_id)) {
          return fail(`Duplicate card button id "${card.button_id}".`)
        }
        seenButtonIds.add(card.button_id)
      }
    }
    return ok()
  }

  return fail('Interactive message must be reply buttons, a list, or a carousel.')
}

/**
 * Short single-line summary used for `conversations.last_message_text`
 * and quick-reply list rows — the body, trimmed, or a sensible fallback.
 */
export function interactivePayloadPreviewText(
  payload: InteractiveMessagePayload,
): string {
  const body = payload.body?.trim()
  if (body) return body
  if (payload.kind === 'buttons') return '[buttons]'
  if (payload.kind === 'list') return '[list]'
  return '[carousel]'
}
