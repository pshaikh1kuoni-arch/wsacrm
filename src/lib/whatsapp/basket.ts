/**
 * A customer's basket, as it arrives from the WhatsApp catalogue (a
 * message of type `order`), checked against our own copy of the catalogue.
 * Pure: no I/O. The webhook does the database reads and writes.
 *
 * The rule that never changes: the total is worked out from OUR catalogue
 * prices, never from the price in the basket. A basket price that matches
 * neither the sale price nor the normal price is flagged, not trusted.
 *
 * Plan: docs/catalog-cart-plan.md
 */

import { effectivePrice, formatCatalogPrice, variantLabel } from './catalog'

/** Meta's cap on one item's quantity in a basket. */
export const BASKET_MAX_QUANTITY = 99

/** One line of the order as Meta sends it. */
export interface MetaOrderItem {
  product_retailer_id: string
  quantity: number
  /** As sent. Meta does not say whether this is the sale or the normal price. */
  item_price: number | null
  currency: string | null
}

export interface MetaOrder {
  catalog_id: string | null
  /** The note the customer typed with the basket, if any. */
  text: string | null
  product_items: MetaOrderItem[]
}

/** The slice of a `catalog_items` row needed to check a basket. */
export interface BasketCatalogItem {
  retailer_id: string
  name: string
  size: string | null
  color: string | null
  price_amount: number | null
  sale_price_amount: number | null
  currency: string | null
  availability: 'in_stock' | 'out_of_stock' | 'other'
  image_url: string | null
}

export type BasketIssue =
  | 'unknown_item'
  | 'out_of_stock'
  | 'no_price'
  | 'price_mismatch'
  | 'bad_quantity'
  | 'catalog_unavailable'

export interface BasketItem {
  retailer_id: string
  /** As sent. */
  quantity: number
  /** As sent. */
  basket_price: number | null
  currency: string | null
  /** From our catalogue copy. Null when the item was not found. */
  name: string | null
  variant: string | null
  image_url: string | null
  /** What the customer pays per unit today: the sale price when there is one. */
  unit_price: number | null
  /** The normal price, kept when a sale price applies. */
  was_price: number | null
  line_total: number | null
  issues: BasketIssue[]
}

export interface BasketPayload {
  catalog_id: string | null
  customer_note: string | null
  currency: string | null
  items: BasketItem[]
  /** Units in the basket (2 mugs and 1 box is 3). */
  item_count: number
  /** From our catalogue prices. Null when any line cannot be priced. */
  total: number | null
  /** The part of the total that can be priced. */
  total_known: number
  status: 'ok' | 'needs_review'
  /** The order exactly as Meta sent it, kept so nothing is lost. */
  raw: unknown
}

function finiteOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const round2 = (n: number) => Math.round(n * 100) / 100
const near = (a: number, b: number) => Math.abs(a - b) < 0.005

/**
 * Read the `order` object of the webhook message. Returns null when it has
 * no usable items, so the caller falls back to treating the message as an
 * unsupported type rather than saving an empty basket.
 */
export function parseOrder(raw: unknown): MetaOrder | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.product_items)) return null

  const product_items: MetaOrderItem[] = []
  for (const entry of o.product_items) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    const id = typeof r.product_retailer_id === 'string' ? r.product_retailer_id.trim() : ''
    if (!id) continue
    product_items.push({
      product_retailer_id: id,
      quantity: Number(r.quantity),
      item_price: finiteOrNull(r.item_price),
      currency: typeof r.currency === 'string' && r.currency.trim() ? r.currency.trim().toUpperCase() : null,
    })
  }
  if (product_items.length === 0) return null

  return {
    catalog_id: typeof o.catalog_id === 'string' && o.catalog_id ? o.catalog_id : null,
    text: typeof o.text === 'string' && o.text.trim() ? o.text.trim() : null,
    product_items,
  }
}

/** True when the price in the basket is a price the catalogue really has. */
function priceMatchesCatalogue(basketPrice: number, item: BasketCatalogItem): boolean {
  const effective = effectivePrice(item)
  return (
    (effective != null && near(basketPrice, effective)) ||
    (item.price_amount != null && near(basketPrice, item.price_amount))
  )
}

export interface EvaluateOptions {
  /** The catalogue lookup itself failed, so no item can be checked. */
  lookupFailed?: boolean
  /** The order exactly as Meta sent it, stored on the basket. */
  raw?: unknown
}

/**
 * Check every line of the order against the catalogue copy and work out the
 * total from catalogue prices.
 */
export function evaluateBasket(
  order: MetaOrder,
  catalog: Map<string, BasketCatalogItem>,
  options: EvaluateOptions = {},
): BasketPayload {
  const items: BasketItem[] = order.product_items.map((line) => {
    const issues: BasketIssue[] = []
    const quantityOk =
      Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= BASKET_MAX_QUANTITY
    if (!quantityOk) issues.push('bad_quantity')

    let found: BasketCatalogItem | undefined
    let unit: number | null = null
    let was: number | null = null

    if (options.lookupFailed) {
      issues.push('catalog_unavailable')
    } else {
      found = catalog.get(line.product_retailer_id)
      if (!found) {
        issues.push('unknown_item')
      } else {
        unit = effectivePrice(found)
        if (unit == null) issues.push('no_price')
        if (unit != null && found.price_amount != null && unit < found.price_amount) {
          was = found.price_amount
        }
        if (found.availability === 'out_of_stock') issues.push('out_of_stock')
        if (
          unit != null &&
          line.item_price != null &&
          !priceMatchesCatalogue(line.item_price, found)
        ) {
          issues.push('price_mismatch')
        }
      }
    }

    return {
      retailer_id: line.product_retailer_id,
      quantity: line.quantity,
      basket_price: line.item_price,
      currency: found?.currency ?? line.currency,
      name: found?.name ?? null,
      variant: found ? variantLabel(found) || null : null,
      image_url: found?.image_url ?? null,
      unit_price: unit,
      was_price: was,
      line_total: quantityOk && unit != null ? round2(unit * line.quantity) : null,
      issues,
    }
  })

  const priced = items.filter((i) => i.line_total != null)
  const total_known = round2(priced.reduce((sum, i) => sum + (i.line_total as number), 0))
  const total = priced.length === items.length ? total_known : null
  const validUnits = items.reduce(
    (n, i) => n + (i.issues.includes('bad_quantity') ? 0 : i.quantity),
    0,
  )

  return {
    catalog_id: order.catalog_id,
    customer_note: order.text,
    currency: items.find((i) => i.currency)?.currency ?? null,
    items,
    item_count: validUnits > 0 ? validUnits : items.length,
    total,
    total_known,
    status: items.some((i) => i.issues.length > 0) ? 'needs_review' : 'ok',
    raw: options.raw ?? null,
  }
}

/** How many problems the basket has in all. */
export function basketIssueCount(basket: BasketPayload): number {
  return basket.items.reduce((n, i) => n + i.issues.length, 0)
}

/**
 * One line for the conversation list and for `messages.content_text`,
 * for example "Basket: 3 items, ₹599". English, like the other stored previews.
 */
export function basketSummary(basket: BasketPayload): string {
  const units = `${basket.item_count} ${basket.item_count === 1 ? 'item' : 'items'}`
  const total = basket.total != null ? `, ${formatCatalogPrice(basket.total, basket.currency)}` : ''
  const review = basket.status === 'needs_review' ? ' (needs review)' : ''
  return `Basket: ${units}${total}${review}`
}

/** The text of the notification a basket raises. English, stored in the database. */
export function basketNotification(
  contactName: string | null,
  basket: BasketPayload,
): { title: string; body: string } {
  const who = contactName?.trim() || 'A customer'
  const units = `${basket.item_count} ${basket.item_count === 1 ? 'item' : 'items'}`
  return {
    title: 'Basket received',
    body: `${who} sent a basket of ${units}.${basket.status === 'needs_review' ? ' It needs review.' : ''}`,
  }
}

/**
 * Who is told about a basket: the agent the chat is assigned to, or when
 * nobody is, everyone who can answer it (owner, admins and agents). Viewers
 * are never notified.
 */
export function pickBasketRecipients(
  assignedAgentId: string | null | undefined,
  members: { user_id: string; account_role: string | null }[],
): string[] {
  if (assignedAgentId) return [assignedAgentId]
  const ids = members
    .filter((m) => m.account_role === 'owner' || m.account_role === 'admin' || m.account_role === 'agent')
    .map((m) => m.user_id)
  return [...new Set(ids)]
}
