'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Search, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import { effectivePrice, formatCatalogPrice, variantLabel } from '@/lib/whatsapp/catalog';
import {
  validateInteractivePayload,
  type InteractiveMessagePayload,
} from '@/lib/whatsapp/interactive';
import {
  buildProductMessage,
  PRODUCT_LIST_MAX,
  PRODUCT_TITLE_MAX,
  type PickerItem,
  type ProductMessageMode,
} from '@/lib/whatsapp/product-message';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 40;
const COLUMNS =
  'retailer_id, name, size, color, price_amount, sale_price_amount, currency, availability, image_url';

type CatalogStatus =
  | { status: 'ok'; catalogId: string; catalogName: string | null; itemCount: number }
  | { status: 'not_ready' };

/** `%`, `,`, `(`, `)`, `*` and `\` are special in a PostgREST filter. */
function cleanTerm(raw: string): string {
  return raw.replace(/[%,()*\\]/g, ' ').trim();
}

/**
 * "Send products": pick items from the synced Meta catalogue, or send the
 * whole catalogue. One product goes as a single card, two to thirty as a
 * list. Plan: docs/catalog-cart-plan.md.
 */
export function ProductPicker({
  open,
  onOpenChange,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with a validated payload; the caller sends it. */
  onSend: (payload: InteractiveMessagePayload) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <PickerBody onClose={() => onOpenChange(false)} onSend={onSend} />
      </DialogContent>
    </Dialog>
  );
}

// Mounted only while the dialog is open, so every open starts clean.
function PickerBody({
  onClose,
  onSend,
}: {
  onClose: () => void;
  onSend: (payload: InteractiveMessagePayload) => void;
}) {
  const t = useTranslations('Catalog.picker');

  const [catalog, setCatalog] = useState<CatalogStatus | 'failed' | null>(null);
  const [mode, setMode] = useState<ProductMessageMode>('products');
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selected, setSelected] = useState<Map<string, PickerItem>>(new Map());
  // Text the agent has typed. Null means "use the default for this mode".
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState<string | null>(null);

  const fetchSeq = useRef(0);

  // Which catalogue, and whether it has been synced yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/catalog');
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          status: string;
          catalogId?: string | null;
          catalogName?: string | null;
          itemCount?: number;
        };
        if (cancelled) return;
        setCatalog(
          body.status === 'ok' && body.catalogId
            ? {
                status: 'ok',
                catalogId: body.catalogId,
                catalogName: body.catalogName ?? null,
                itemCount: body.itemCount ?? 0,
              }
            : { status: 'not_ready' },
        );
      } catch {
        if (!cancelled) setCatalog('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Search waits for a short pause in typing.
  useEffect(() => {
    const id = setTimeout(() => {
      setTerm(cleanTerm(query));
      setLimit(PAGE_SIZE);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const ready = typeof catalog === 'object' && catalog !== null && catalog.status === 'ok';

  useEffect(() => {
    if (!ready || mode !== 'products') return;
    const seq = ++fetchSeq.current;
    (async () => {
      setLoadingItems(true);
      let q = createClient()
        .from('catalog_items')
        .select(COLUMNS, { count: 'exact' })
        .order('name')
        .order('retailer_id')
        .range(0, limit - 1);
      if (term) {
        const like = `%${term}%`;
        q = q.or(`name.ilike.${like},retailer_id.ilike.${like}`);
      }
      const { data, count, error } = await q;
      if (seq !== fetchSeq.current) return; // a newer search took over
      setLoadingItems(false);
      if (error) {
        toast.error(t('loadFailed'));
        return;
      }
      setItems((data ?? []) as PickerItem[]);
      setTotal(count ?? 0);
    })();
  }, [ready, mode, term, limit, t]);

  const defaultBody =
    mode === 'catalog' ? t('bodyDefaultCatalog') : t('bodyDefaultProducts');
  const body = bodyEdit ?? defaultBody;
  const title = titleEdit ?? t('titleDefault');
  const count = selected.size;
  const atLimit = count >= PRODUCT_LIST_MAX;
  // A list needs a title; a single product card does not have one.
  const titleOk = count <= 1 || title.trim() !== '';
  const canSend =
    ready && body.trim() !== '' && (mode === 'catalog' || (count >= 1 && titleOk));

  function toggle(item: PickerItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.retailer_id)) next.delete(item.retailer_id);
      else if (next.size < PRODUCT_LIST_MAX) next.set(item.retailer_id, item);
      return next;
    });
  }

  function send() {
    if (!ready) return;
    try {
      const payload = buildProductMessage({
        catalogId: catalog.catalogId,
        mode,
        items: [...selected.values()],
        body,
        title,
      });
      const check = validateInteractivePayload(payload);
      if (!check.ok) {
        toast.error(check.error);
        return;
      }
      onSend(payload);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loadFailed'));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
        {ready ? (
          <DialogDescription>
            {t('description', { name: catalog.catalogName ?? '', count: catalog.itemCount })}
          </DialogDescription>
        ) : null}
      </DialogHeader>

      {catalog === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('loadingCatalogue')}
        </p>
      ) : catalog === 'failed' ? (
        <p className="py-6 text-sm text-muted-foreground">{t('loadFailed')}</p>
      ) : !ready ? (
        <div className="flex flex-col items-start gap-3 py-4">
          <p className="text-sm text-muted-foreground">{t('notSynced')}</p>
          <Link
            href="/settings?tab=catalog"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onClose}
          >
            {t('goToSettings')}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="inline-flex self-start rounded-xl bg-muted p-0.5">
            {(['products', 'catalog'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-card text-foreground shadow-card-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'products' ? t('modeProducts') : t('modeCatalog')}
              </button>
            ))}
          </div>

          {mode === 'products' ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search')}
                  className="bg-muted pl-9 text-foreground"
                />
              </div>

              <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-border">
                {items.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    {loadingItems ? t('loadingCatalogue') : t('noResults')}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <ProductRow
                        key={item.retailer_id}
                        item={item}
                        checked={selected.has(item.retailer_id)}
                        disabled={
                          item.availability === 'out_of_stock' ||
                          (atLimit && !selected.has(item.retailer_id))
                        }
                        onToggle={() => toggle(item)}
                        outOfStockLabel={t('outOfStock')}
                      />
                    ))}
                  </ul>
                )}
                {items.length < total ? (
                  <div className="border-t border-border p-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={loadingItems}
                      onClick={() => setLimit((l) => l + PAGE_SIZE)}
                    >
                      {loadingItems ? <Loader2 className="size-4 animate-spin" /> : t('showMore')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {t('hintCatalog')}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('bodyLabel')}</label>
            <Textarea
              value={body}
              maxLength={1024}
              onChange={(e) => setBodyEdit(e.target.value)}
              className="min-h-16 bg-muted text-foreground"
            />
          </div>

          {mode === 'products' && count > 1 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('titleLabel')}</label>
              <Input
                value={title}
                maxLength={PRODUCT_TITLE_MAX}
                onChange={(e) => setTitleEdit(e.target.value)}
                className="bg-muted text-foreground"
              />
            </div>
          ) : null}
        </div>
      )}

      {ready ? (
        <DialogFooter className="items-center sm:justify-between">
          <div className="text-left">
            {mode === 'products' ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  {t('selectedCount', { count, max: PRODUCT_LIST_MAX })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {atLimit ? t('limitReached', { max: PRODUCT_LIST_MAX }) : t('hintSingle')}
                </p>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            {mode === 'products' && count > 0 ? (
              <Button variant="outline" onClick={() => setSelected(new Map())}>
                {t('clear')}
              </Button>
            ) : null}
            <Button onClick={send} disabled={!canSend}>
              <Send className="mr-1 size-4" />
              {mode === 'catalog' ? t('sendCatalogue') : t('sendProducts', { count })}
            </Button>
          </div>
        </DialogFooter>
      ) : null}
    </>
  );
}

function ProductRow({
  item,
  checked,
  disabled,
  onToggle,
  outOfStockLabel,
}: {
  item: PickerItem;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  outOfStockLabel: string;
}) {
  const price = effectivePrice(item);
  const sale = price != null && item.price_amount != null && price < item.price_amount;
  const variant = variantLabel(item);
  const outOfStock = item.availability === 'out_of_stock';

  return (
    <li>
      <label
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/50',
          checked && 'bg-primary-soft',
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="size-4 shrink-0 accent-primary"
        />
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
            <ImageIcon className="size-4 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[variant, `#${item.retailer_id}`].filter(Boolean).join(' · ')}
            {outOfStock ? ` · ${outOfStockLabel}` : ''}
          </span>
        </span>
        {price != null ? (
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-sm font-semibold text-foreground">
              {formatCatalogPrice(price, item.currency)}
            </span>
            {sale && item.price_amount != null ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatCatalogPrice(item.price_amount, item.currency)}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    </li>
  );
}
