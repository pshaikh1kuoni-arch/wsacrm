/**
 * Pure helpers for the Meta product catalogue copy. No I/O: the Graph
 * calls live in `meta-api.ts` and the database writes in
 * `catalog-sync.ts`, so everything here is unit-testable.
 *
 * Plan: docs/catalog-cart-plan.md
 */

/** The fields we ask Meta for on every catalogue item. */
export const CATALOG_PRODUCT_FIELDS =
  'retailer_id,retailer_product_group_id,name,price,sale_price,currency,availability,image_url,url,size,color,capability_to_review_status'

export type CatalogAvailability = 'in_stock' | 'out_of_stock' | 'other'

/**
 * Meta's own WhatsApp review of one item. Meta will not send an item whose
 * status is `outdated` (it changed after the last review): a list drops it
 * silently and a single product is refused. See docs/catalog-cart-plan.md,
 * Step 2b.
 */
export type WhatsAppStatus = 'approved' | 'outdated' | 'no_review' | 'other'

/** One item as the Graph API returns it for `CATALOG_PRODUCT_FIELDS`. */
export interface MetaCatalogProduct {
  id?: string
  retailer_id?: string
  retailer_product_group_id?: string
  name?: string
  /** Formatted by Meta, e.g. "₹1,210.00". */
  price?: string
  sale_price?: string
  currency?: string
  /** "in stock", "out of stock", "preorder", … */
  availability?: string
  image_url?: string
  url?: string
  /** Variant attributes. Variants of one product share a name. */
  size?: string
  color?: string
  /** Review status per Meta channel, e.g. `{ key: 'WHATSAPP', value: 'OUTDATED' }`. */
  capability_to_review_status?: { key?: string; value?: string }[]
}

/** A row of `catalog_items` (migrations 052, 053 and 057). */
export interface CatalogItemRow {
  account_id: string
  catalog_id: string
  retailer_id: string
  meta_item_id: string | null
  group_id: string | null
  name: string
  price_amount: number | null
  sale_price_amount: number | null
  currency: string | null
  availability: CatalogAvailability
  image_url: string | null
  product_url: string | null
  size: string | null
  color: string | null
  /** Null until Meta has told us (before the first sync after migration 057). */
  whatsapp_status: WhatsAppStatus | null
  synced_at: string
}

/**
 * Turn Meta's formatted price text into a number.
 *
 * Handles "₹1,210.00", "₹1,21,000.00" (Indian grouping), "1.210,50 €"
 * (comma as the decimal mark) and "INR 300". Returns null when there is no
 * digit in the text. A lone "1.210" is read as 1.21, because Meta writes
 * a dot as the decimal mark when nothing else is present.
 */
export function parsePriceAmount(text: string | null | undefined): number | null {
  if (!text) return null
  const cleaned = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(cleaned)) return null

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')
  let normalized: string
  if (lastDot >= 0 && lastComma >= 0) {
    // Both marks present: the one that comes last is the decimal mark.
    const decimalMark = lastDot > lastComma ? '.' : ','
    const thousandsMark = decimalMark === '.' ? ',' : '.'
    normalized = cleaned.split(thousandsMark).join('').replace(decimalMark, '.')
  } else if (lastComma >= 0) {
    // Only commas: a single comma with 1 or 2 digits after it is a decimal
    // mark ("12,50"); anything else is a thousands mark ("1,210").
    const digitsAfter = cleaned.length - lastComma - 1
    const commaCount = cleaned.split(',').length - 1
    normalized =
      commaCount === 1 && digitsAfter > 0 && digitsAfter <= 2
        ? cleaned.replace(',', '.')
        : cleaned.split(',').join('')
  } else {
    normalized = cleaned
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Meta's availability text → the three states the CRM cares about. */
export function normalizeAvailability(raw: string | null | undefined): CatalogAvailability {
  const v = (raw ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (v === 'in stock') return 'in_stock'
  if (v === 'out of stock') return 'out_of_stock'
  return 'other'
}

/**
 * The WhatsApp entry of Meta's per-channel review list, as one of four
 * states. Null when Meta did not send the list or has no WhatsApp entry, so
 * an unknown item is never warned about.
 */
export function normalizeWhatsAppStatus(
  list: { key?: string; value?: string }[] | null | undefined,
): WhatsAppStatus | null {
  if (!Array.isArray(list)) return null
  const entry = list.find((c) => c?.key?.trim().toUpperCase() === 'WHATSAPP')
  const value = entry?.value?.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (!value) return null
  if (value === 'APPROVED') return 'approved'
  if (value === 'OUTDATED') return 'outdated'
  if (value === 'NO_REVIEW') return 'no_review'
  // PENDING, REJECTED and any status Meta adds later.
  return 'other'
}

/**
 * True when Meta will probably not send this item on WhatsApp. Approved,
 * never reviewed and unknown items are not flagged.
 */
export function isNotReadyOnWhatsApp(status: WhatsAppStatus | null | undefined): boolean {
  return status === 'outdated' || status === 'other'
}

/** How many of these items Meta will probably not send. */
export function countNotReady(items: { whatsapp_status?: WhatsAppStatus | null }[]): number {
  return items.reduce((n, i) => n + (isNotReadyOnWhatsApp(i.whatsapp_status) ? 1 : 0), 0)
}

/**
 * One Meta item → a `catalog_items` row. Returns null for an item that
 * cannot be used: no retailer ID (a basket could never point at it) or no
 * name.
 */
export function toCatalogRow(
  accountId: string,
  catalogId: string,
  product: MetaCatalogProduct,
  syncedAt: string,
): CatalogItemRow | null {
  const retailerId = product.retailer_id?.trim()
  const name = product.name?.trim()
  if (!retailerId || !name) return null

  const currency = product.currency?.trim().toUpperCase()
  return {
    account_id: accountId,
    catalog_id: catalogId,
    retailer_id: retailerId,
    meta_item_id: product.id ?? null,
    group_id: product.retailer_product_group_id?.trim() || null,
    name,
    price_amount: parsePriceAmount(product.price),
    sale_price_amount: parsePriceAmount(product.sale_price),
    currency: currency || null,
    availability: normalizeAvailability(product.availability),
    image_url: product.image_url || null,
    product_url: product.url || null,
    size: product.size?.trim() || null,
    color: product.color?.trim() || null,
    whatsapp_status: normalizeWhatsAppStatus(product.capability_to_review_status),
    synced_at: syncedAt,
  }
}

/**
 * The price a customer actually sees: the sale price when one is set and
 * lower than the normal price, otherwise the normal price. Null when the
 * item has no price at all.
 */
export function effectivePrice(item: {
  price_amount: number | null
  sale_price_amount: number | null
}): number | null {
  const { price_amount: price, sale_price_amount: sale } = item
  if (sale != null && (price == null || sale < price)) return sale
  return price
}

/**
 * What tells one variant from another, for example "12x18in · Black".
 * Empty when the item has neither a size nor a colour.
 */
export function variantLabel(item: {
  size?: string | null
  color?: string | null
}): string {
  return [item.size, item.color]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v)
    .join(' · ')
}

/**
 * A price for people to read, such as "₹1,210" or "₹149.50". Whole amounts
 * drop the decimals. Falls back to a plain number when there is no currency.
 */
export function formatCatalogPrice(amount: number, currency: string | null): string {
  const fraction = Number.isInteger(amount) ? 0 : 2
  if (!currency) return amount.toFixed(fraction)
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(fraction)} ${currency}`
  }
}

/** Structural shape of `MetaApiError`, so this module stays free of I/O imports. */
export interface CatalogErrorLike {
  message: string
  code?: number | null
  subcode?: number | null
  httpStatus?: number | null
  fbtraceId?: string | null
}

export interface CatalogErrorExplanation {
  summary: string
  /** 'user' when something in Meta or the settings has to change. */
  side: 'user' | 'meta'
  httpStatus: 400 | 502
  code: number | null
  subcode: number | null
  fbtraceId: string | null
  metaMessage: string
}

/** Say, in plain words, why a catalogue call to Meta failed. */
export function explainCatalogError(err: CatalogErrorLike): CatalogErrorExplanation {
  const code = err.code ?? null
  const message = err.message ?? ''
  const base = {
    code,
    subcode: err.subcode ?? null,
    fbtraceId: err.fbtraceId ?? null,
    metaMessage: message,
  }

  if (code === 190) {
    return {
      ...base,
      side: 'user',
      httpStatus: 400,
      summary:
        'Meta rejected the access token. Save a new token in the WhatsApp connection.',
    }
  }
  if (
    code === 100 &&
    /not been approved to use this api|missing permission|reviewable feature/i.test(message)
  ) {
    return {
      ...base,
      side: 'user',
      httpStatus: 400,
      summary:
        'The access token cannot read the catalogue. In Meta Business settings, give the system user access to the catalogue, create a new token with the catalog_management permission, and save it in the WhatsApp connection.',
    }
  }
  if (
    err.httpStatus === 429 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613
  ) {
    return {
      ...base,
      side: 'meta',
      httpStatus: 502,
      summary: 'Meta says there were too many requests. Wait a minute and try again.',
    }
  }
  return {
    ...base,
    side: 'meta',
    httpStatus: 502,
    summary: 'Meta returned an error while reading the catalogue. Try again in a moment.',
  }
}
