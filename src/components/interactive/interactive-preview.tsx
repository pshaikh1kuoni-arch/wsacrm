"use client";

import { Image as ImageIcon, List, Reply, ShoppingBag, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InteractiveMessagePayload,
  InteractiveProductDisplay,
} from "@/lib/whatsapp/interactive";

/**
 * WhatsApp-style read-only render of an interactive message. Used both
 * in the builder's live preview and by the inbox message bubble so a
 * sent buttons/list message shows the same way it does on the phone.
 *
 * Purely presentational — the buttons/rows are not clickable here (the
 * customer taps them on their own device). Kept namespace-free so it can
 * be dropped into the composer, the automation builder, and the
 * quick-replies manager without namespace coupling: the three fallback
 * labels shown for empty fields default to plain English, and a host
 * that has a translator can pass its own via `labels`.
 */
export interface InteractivePreviewLabels {
  /** Shown in place of an empty body. */
  body?: string;
  /** Shown in place of an untitled reply button. */
  button?: string;
  /** Shown in place of an empty list button label. */
  menu?: string;
  /** Button under a single product card. */
  view?: string;
  /** Button under a product list. */
  viewItems?: string;
  /** Button under a catalogue message. */
  viewCatalogue?: string;
  /** Line under a product list that shows more products than fit. */
  more?: (count: number) => string;
}

export function InteractivePreview({
  payload,
  className,
  labels,
}: {
  payload: InteractiveMessagePayload;
  className?: string;
  labels?: InteractivePreviewLabels;
}) {
  const bodyLabel = labels?.body ?? "Message body…";
  const buttonLabel = labels?.button ?? "Button";
  const menuLabel = labels?.menu ?? "Menu";
  // Only some kinds carry a header; carousel has neither header nor footer.
  const header =
    payload.kind === "buttons" ||
    payload.kind === "list" ||
    payload.kind === "product_list"
      ? payload.header
      : undefined;
  const footer = payload.kind === "carousel" ? undefined : payload.footer;
  return (
    <div
      className={cn(
        "w-full max-w-[260px] overflow-hidden rounded-lg bg-card text-foreground shadow-sm ring-1 ring-border",
        className,
      )}
    >
      <div className="px-3 py-2">
        {header ? (
          <p className="mb-1 break-words text-sm font-semibold">{header}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm">
          {payload.body || (
            <span className="text-muted-foreground">{bodyLabel}</span>
          )}
        </p>
        {footer ? (
          <p className="mt-1 break-words text-[11px] text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </div>

      {payload.kind === "buttons" ? (
        <div className="flex flex-col border-t border-border">
          {payload.buttons.map((b, i) => (
            <button
              key={b.id || i}
              type="button"
              disabled
              className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary first:border-t-0"
            >
              <Reply className="h-3.5 w-3.5" />
              <span className="truncate">{b.title || buttonLabel}</span>
            </button>
          ))}
        </div>
      ) : payload.kind === "list" ? (
        <button
          type="button"
          disabled
          className="flex w-full items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary"
        >
          <List className="h-3.5 w-3.5" />
          <span className="truncate">{payload.button_label || menuLabel}</span>
        </button>
      ) : payload.kind === "carousel" ? (
        <div className="border-t border-border py-2">
          <div className="flex gap-2 overflow-x-auto px-3 pb-1">
            {payload.cards.map((card, i) => (
              <div
                key={i}
                className="w-28 shrink-0 overflow-hidden rounded-md border border-border"
              >
                <div className="flex h-16 items-center justify-center bg-muted">
                  {card.header.url ? (
                    card.header.type === "video" ? (
                      <video
                        src={card.header.url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.header.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : card.header.type === "video" ? (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-1 bg-card p-1.5">
                  {card.body ? (
                    <p className="line-clamp-2 whitespace-pre-wrap break-words text-[10px]">
                      {card.body}
                    </p>
                  ) : null}
                  <span className="truncate border-t border-border pt-1 text-center text-[10px] font-medium text-primary">
                    {card.button_label || buttonLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-center gap-1">
            {payload.cards.map((_, i) => (
              <span key={i} className="h-1 w-1 rounded-full bg-border" />
            ))}
          </div>
        </div>
      ) : payload.kind === "product" ? (
        <div className="border-t border-border">
          {payload.display ? (
            <div className="flex gap-2 px-3 py-2">
              <ProductThumb url={payload.display.image_url} className="h-14 w-14" />
              <div className="min-w-0">
                <p className="line-clamp-2 break-words text-sm font-medium">
                  {payload.display.name}
                </p>
                {payload.display.variant ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {payload.display.variant}
                  </p>
                ) : null}
                <ProductPrice item={payload.display} />
              </div>
            </div>
          ) : null}
          <span className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary">
            <ShoppingBag className="h-3.5 w-3.5" />
            {labels?.view ?? "View"}
          </span>
        </div>
      ) : payload.kind === "product_list" ? (
        <div className="border-t border-border">
          {(payload.display ?? []).slice(0, 3).map((item) => (
            <div
              key={item.retailer_id}
              className="flex items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
            >
              <ProductThumb url={item.image_url} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.name}</p>
                {item.variant ? (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.variant}
                  </p>
                ) : null}
              </div>
              {item.price_text ? (
                <span className="shrink-0 text-xs font-semibold">
                  {item.price_text}
                </span>
              ) : null}
            </div>
          ))}
          {productListMore(payload) > 0 ? (
            <p className="px-3 py-1 text-[11px] text-muted-foreground">
              {labels?.more
                ? labels.more(productListMore(payload))
                : `+${productListMore(payload)} more`}
            </p>
          ) : null}
          <span className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary">
            <List className="h-3.5 w-3.5" />
            {labels?.viewItems ?? "View items"}
          </span>
        </div>
      ) : (
        <span className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-sm font-medium text-primary">
          <ShoppingBag className="h-3.5 w-3.5" />
          {labels?.viewCatalogue ?? "View catalogue"}
        </span>
      )}
    </div>
  );
}

/** How many products of a list the preview cannot show. */
function productListMore(payload: {
  sections: { retailer_ids: string[] }[];
  display?: InteractiveProductDisplay[];
}): number {
  const total = payload.sections.reduce((n, s) => n + s.retailer_ids.length, 0);
  return Math.max(0, total - Math.min(3, payload.display?.length ?? 0));
}

function ProductThumb({ url, className }: { url?: string; className: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn("shrink-0 rounded-md object-cover", className)} />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted",
        className,
      )}
    >
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

function ProductPrice({ item }: { item: InteractiveProductDisplay }) {
  if (!item.price_text) return null;
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold">{item.price_text}</span>
      {item.was_text ? (
        <span className="text-[11px] text-muted-foreground line-through">
          {item.was_text}
        </span>
      ) : null}
    </span>
  );
}
