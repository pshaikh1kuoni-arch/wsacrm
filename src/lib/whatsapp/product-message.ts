/**
 * Turn what an agent picked in the product picker into the interactive
 * message payload the send path understands. Pure: no I/O.
 *
 * One product sends a single product card, two to thirty send a product
 * list, and the whole catalogue sends a "View catalogue" message.
 *
 * Plan: docs/catalog-cart-plan.md
 */

import { effectivePrice, formatCatalogPrice, variantLabel } from './catalog'
import type {
  InteractiveMessagePayload,
  InteractiveProductDisplay,
} from './interactive'
import { INTERACTIVE_LIMITS } from './meta-api'

/** The slice of a `catalog_items` row the picker needs. */
export interface PickerItem {
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

/** How many products one message can carry. */
export const PRODUCT_LIST_MAX = INTERACTIVE_LIMITS.maxProductListProducts

/** Section titles are capped by Meta; the same short title also heads the list. */
export const PRODUCT_TITLE_MAX = INTERACTIVE_LIMITS.productListSectionTitleMaxLength

/** What a customer pays and what it normally costs, as readable text. */
export function toProductDisplay(item: PickerItem): InteractiveProductDisplay {
  const price = effectivePrice(item)
  const display: InteractiveProductDisplay = {
    retailer_id: item.retailer_id,
    name: item.name,
  }
  const variant = variantLabel(item)
  if (variant) display.variant = variant
  if (price != null) {
    display.price_text = formatCatalogPrice(price, item.currency)
    // Show the normal price struck through only when a sale price applies.
    if (item.price_amount != null && price < item.price_amount) {
      display.was_text = formatCatalogPrice(item.price_amount, item.currency)
    }
  }
  if (item.image_url) display.image_url = item.image_url
  return display
}

export type ProductMessageMode = 'products' | 'catalog'

export interface BuildProductMessageArgs {
  catalogId: string
  mode: ProductMessageMode
  /** The picked items. Ignored for the whole catalogue. */
  items: PickerItem[]
  body: string
  /** Short title for a product list (also its section title). */
  title: string
  footer?: string
}

export function buildProductMessage(args: BuildProductMessageArgs): InteractiveMessagePayload {
  const body = args.body.trim()
  const footer = args.footer?.trim() || undefined

  if (args.mode === 'catalog') {
    return { kind: 'catalog', body, ...(footer ? { footer } : {}) }
  }

  if (args.items.length < 1) {
    throw new Error('Pick at least one product.')
  }
  if (args.items.length > PRODUCT_LIST_MAX) {
    throw new Error(`Pick at most ${PRODUCT_LIST_MAX} products.`)
  }

  if (args.items.length === 1) {
    const [item] = args.items
    return {
      kind: 'product',
      body,
      ...(footer ? { footer } : {}),
      catalog_id: args.catalogId,
      retailer_id: item.retailer_id,
      display: toProductDisplay(item),
    }
  }

  const title = args.title.trim().slice(0, PRODUCT_TITLE_MAX)
  return {
    kind: 'product_list',
    body,
    header: title,
    ...(footer ? { footer } : {}),
    catalog_id: args.catalogId,
    sections: [{ title, retailer_ids: args.items.map((i) => i.retailer_id) }],
    display: args.items.map(toProductDisplay),
  }
}
