import { describe, expect, it } from 'vitest'

import {
  validateInteractivePayload,
  interactivePayloadPreviewText,
  type InteractiveButtonsPayload,
  type InteractiveListPayload,
  type InteractiveCarouselPayload,
} from './interactive'

const validButtons: InteractiveButtonsPayload = {
  kind: 'buttons',
  body: 'Choose an option',
  buttons: [
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ],
}

const validList: InteractiveListPayload = {
  kind: 'list',
  body: 'Pick a service',
  button_label: 'View menu',
  sections: [
    {
      title: 'Services',
      rows: [
        { id: 'seo', title: 'SEO', description: 'Search optimization' },
        { id: 'ads', title: 'Ads' },
      ],
    },
  ],
}

describe('validateInteractivePayload — buttons', () => {
  it('accepts a well-formed buttons payload', () => {
    expect(validateInteractivePayload(validButtons)).toEqual({ ok: true })
  })

  it('rejects a missing/empty payload', () => {
    expect(validateInteractivePayload(undefined).ok).toBe(false)
    expect(validateInteractivePayload(null).ok).toBe(false)
  })

  it('requires a non-empty body within 1024 chars', () => {
    expect(validateInteractivePayload({ ...validButtons, body: '' }).ok).toBe(false)
    const long = validateInteractivePayload({ ...validButtons, body: 'x'.repeat(1025) })
    expect(long.ok).toBe(false)
  })

  it('requires 1-3 buttons', () => {
    expect(validateInteractivePayload({ ...validButtons, buttons: [] }).ok).toBe(false)
    const four = validateInteractivePayload({
      ...validButtons,
      buttons: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' },
        { id: 'd', title: 'D' },
      ],
    })
    expect(four.ok).toBe(false)
  })

  it('caps button title at 20 chars', () => {
    const res = validateInteractivePayload({
      ...validButtons,
      buttons: [{ id: 'a', title: 'x'.repeat(21) }],
    })
    expect(res.ok).toBe(false)
  })

  it('rejects duplicate button ids', () => {
    const res = validateInteractivePayload({
      ...validButtons,
      buttons: [
        { id: 'dup', title: 'A' },
        { id: 'dup', title: 'B' },
      ],
    })
    expect(res).toEqual({ ok: false, error: 'Duplicate button id "dup".' })
  })

  it('rejects empty button id / title', () => {
    expect(
      validateInteractivePayload({ ...validButtons, buttons: [{ id: '', title: 'A' }] }).ok,
    ).toBe(false)
    expect(
      validateInteractivePayload({ ...validButtons, buttons: [{ id: 'a', title: '' }] }).ok,
    ).toBe(false)
  })
})

describe('validateInteractivePayload — list', () => {
  it('accepts a well-formed list payload', () => {
    expect(validateInteractivePayload(validList)).toEqual({ ok: true })
  })

  it('requires a button label within 20 chars', () => {
    expect(validateInteractivePayload({ ...validList, button_label: '' }).ok).toBe(false)
    expect(
      validateInteractivePayload({ ...validList, button_label: 'x'.repeat(21) }).ok,
    ).toBe(false)
  })

  it('caps total rows at 10 across sections', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: `Row ${i}` }))
    const res = validateInteractivePayload({
      ...validList,
      sections: [{ rows }],
    })
    expect(res.ok).toBe(false)
  })

  it('caps list row title at 24 chars', () => {
    const res = validateInteractivePayload({
      ...validList,
      sections: [{ rows: [{ id: 'r', title: 'x'.repeat(25) }] }],
    })
    expect(res.ok).toBe(false)
  })

  it('rejects duplicate row ids across sections', () => {
    const res = validateInteractivePayload({
      ...validList,
      sections: [
        { rows: [{ id: 'dup', title: 'A' }] },
        { rows: [{ id: 'dup', title: 'B' }] },
      ],
    })
    expect(res.ok).toBe(false)
  })
})

const validCarousel: InteractiveCarouselPayload = {
  kind: 'carousel',
  body: "Here are this week's top picks",
  button_mode: 'url',
  cards: [
    {
      header: { type: 'image', url: 'https://example.com/a.jpg' },
      body: 'Sandalwood — ₹1,499',
      button_label: 'Buy now',
      button_url: 'https://shop.example.com/sandalwood',
    },
    {
      header: { type: 'video', url: 'https://example.com/b.mp4' },
      body: 'Gift Set — ₹3,999',
      button_label: 'Buy now',
      button_url: 'https://shop.example.com/gift-set',
    },
  ],
}

describe('validateInteractivePayload — carousel', () => {
  it('accepts a well-formed carousel payload', () => {
    expect(validateInteractivePayload(validCarousel)).toEqual({ ok: true })
  })

  it('requires 2-10 cards', () => {
    expect(validateInteractivePayload({ ...validCarousel, cards: [validCarousel.cards[0]] }).ok).toBe(
      false,
    )
    const eleven = validateInteractivePayload({
      ...validCarousel,
      cards: Array.from({ length: 11 }, () => validCarousel.cards[0]),
    })
    expect(eleven.ok).toBe(false)
  })

  it('rejects an unknown button_mode', () => {
    expect(
      validateInteractivePayload({ ...validCarousel, button_mode: 'sms' }).ok,
    ).toBe(false)
  })

  it('requires an image/video header per card', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], header: { type: 'document', url: 'x' } },
        validCarousel.cards[1],
      ],
    })
    expect(res.ok).toBe(false)
  })

  it('caps card body at 160 chars', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [{ ...validCarousel.cards[0], body: 'x'.repeat(161) }, validCarousel.cards[1]],
    })
    expect(res.ok).toBe(false)
  })

  it('caps card button label at 20 chars', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [
        { ...validCarousel.cards[0], button_label: 'x'.repeat(21) },
        validCarousel.cards[1],
      ],
    })
    expect(res.ok).toBe(false)
  })

  it('requires button_url when button_mode is url', () => {
    const res = validateInteractivePayload({
      ...validCarousel,
      cards: [{ ...validCarousel.cards[0], button_url: undefined }, validCarousel.cards[1]],
    })
    expect(res.ok).toBe(false)
  })

  it('requires button_id when button_mode is quick_reply, and rejects duplicates', () => {
    const quickReplyCarousel = {
      ...validCarousel,
      button_mode: 'quick_reply' as const,
      cards: [
        { ...validCarousel.cards[0], button_url: undefined, button_id: 'card_1' },
        { ...validCarousel.cards[1], button_url: undefined, button_id: undefined },
      ],
    }
    expect(validateInteractivePayload(quickReplyCarousel).ok).toBe(false)

    const dup = {
      ...quickReplyCarousel,
      cards: [
        { ...quickReplyCarousel.cards[0], button_id: 'dup' },
        { ...quickReplyCarousel.cards[0], button_id: 'dup' },
      ],
    }
    expect(validateInteractivePayload(dup).ok).toBe(false)
  })
})

describe('interactivePayloadPreviewText', () => {
  it('returns the trimmed body', () => {
    expect(interactivePayloadPreviewText({ ...validButtons, body: '  Hi  ' })).toBe('Hi')
  })
  it('falls back when body is blank', () => {
    expect(interactivePayloadPreviewText({ ...validButtons, body: '   ' })).toBe('[buttons]')
    expect(interactivePayloadPreviewText({ ...validList, body: '' })).toBe('[list]')
    expect(interactivePayloadPreviewText({ ...validCarousel, body: '' })).toBe('[carousel]')
  })
})
