'use client';

import { AlertTriangle, Check, ImageIcon, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatCatalogPrice } from '@/lib/whatsapp/catalog';
import {
  basketIssueCount,
  type BasketIssue,
  type BasketItem,
  type BasketPayload,
} from '@/lib/whatsapp/basket';

/**
 * A customer's basket in the chat: what they picked, what it comes to at
 * our catalogue prices, and anything that did not check out. It is not an
 * order, so it only says whether it needs follow up or a closer look.
 * Plan: docs/catalog-cart-plan.md.
 */
export function BasketCard({ basket }: { basket: BasketPayload }) {
  const t = useTranslations('Catalog.basket');
  const review = basket.status === 'needs_review';
  const money = (amount: number, currency: string | null) =>
    formatCatalogPrice(amount, currency ?? basket.currency);

  return (
    <div className="w-72 max-w-full rounded-xl bg-card p-3 text-foreground shadow-card-sm ring-1 ring-border sm:w-80">
      <div className="flex items-center gap-2 pb-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full',
            review ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'bg-primary-soft text-primary',
          )}
        >
          <ShoppingBag className="size-3.5" />
        </span>
        <span className="text-sm font-semibold">{t('title')}</span>
      </div>

      {basket.customer_note ? (
        <p className="mb-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t('note')}: </span>
          {basket.customer_note}
        </p>
      ) : null}

      <ul className="divide-y divide-border border-t border-border">
        {basket.items.map((item, i) => (
          <BasketRow
            key={`${item.retailer_id}-${i}`}
            item={item}
            money={money}
            fallbackCurrency={basket.currency}
          />
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 border-t border-border py-2.5">
        <span className="text-xs text-muted-foreground">
          {basket.total != null ? t('total') : t('totalUnconfirmed')}
        </span>
        <span className="text-right text-sm font-bold">
          {basket.total != null
            ? money(basket.total, basket.currency)
            : basket.total_known > 0
              ? t('totalSoFar', { amount: money(basket.total_known, basket.currency) })
              : null}
        </span>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold',
          review
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'bg-primary-soft text-primary',
        )}
      >
        {review ? (
          <AlertTriangle className="size-3.5 shrink-0" />
        ) : (
          <Check className="size-3.5 shrink-0" />
        )}
        {review ? t('statusReview', { count: basketIssueCount(basket) }) : t('statusOk')}
      </div>
    </div>
  );
}

function BasketRow({
  item,
  money,
  fallbackCurrency,
}: {
  item: BasketItem;
  money: (amount: number, currency: string | null) => string;
  fallbackCurrency: string | null;
}) {
  const t = useTranslations('Catalog.basket');
  const currency = item.currency ?? fallbackCurrency;

  return (
    <li className="flex items-start gap-2.5 py-2">
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="" className="size-9 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground">
          {item.name ? <ImageIcon className="size-4" /> : '?'}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words text-xs font-semibold">{item.name ?? t('unknownItem')}</p>
        {item.variant ? (
          <p className="truncate text-[11px] text-muted-foreground">{item.variant}</p>
        ) : null}
        {item.unit_price != null ? (
          <p className="text-[11px] text-muted-foreground">
            {t('each', { price: money(item.unit_price, currency) })}
            {item.was_price != null ? (
              <span className="ml-1 line-through">{money(item.was_price, currency)}</span>
            ) : null}
          </p>
        ) : null}
        {item.issues.map((issue) => (
          <p key={issue} className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            {issueText(issue, item, t, money, currency)}
          </p>
        ))}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] text-muted-foreground">{t('qty', { count: item.quantity })}</p>
        {item.line_total != null ? (
          <p className="text-xs font-semibold">{money(item.line_total, currency)}</p>
        ) : null}
      </div>
    </li>
  );
}

function issueText(
  issue: BasketIssue,
  item: BasketItem,
  t: ReturnType<typeof useTranslations>,
  money: (amount: number, currency: string | null) => string,
  currency: string | null,
): string {
  switch (issue) {
    case 'unknown_item':
      return t('issueUnknown', { id: item.retailer_id });
    case 'out_of_stock':
      return t('issueOutOfStock');
    case 'no_price':
      return t('issueNoPrice');
    case 'bad_quantity':
      return t('issueQuantity');
    case 'catalog_unavailable':
      return t('issueLookup');
    case 'price_mismatch':
      return t('issuePrice', {
        basket: item.basket_price != null ? money(item.basket_price, currency) : '',
        catalogue: item.unit_price != null ? money(item.unit_price, currency) : '',
      });
  }
}
