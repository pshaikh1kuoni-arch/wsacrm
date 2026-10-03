// Business details shown on the public pages (pricing, terms, privacy,
// refunds, delivery, about, contact) and in the site footer. One place,
// so a change of address or email is a one-line edit.
//
// No phone number is listed because none has been provided. Add `phone`
// here and the Contact page and footer will show it.

export const SITE = {
  brand: 'WAGenie',
  operator: 'Parvez Shaikh',
  email: 'parvezaigyaan@gmail.com',
  phone: null as string | null,
  addressLines: ['Govandi', 'Mumbai 400043', 'India'] as const,
  /** Monthly price in rupees, shown on the pricing page and in the terms. */
  priceRupees: 2500,
  /** Shown as "Last updated" on the legal pages. */
  legalUpdated: '3 October 2026',
} as const

export const ADDRESS_ONE_LINE = SITE.addressLines.join(', ')

export const PRICE_LABEL = `₹${SITE.priceRupees.toLocaleString('en-IN')}`
