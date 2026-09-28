"use client";

import { useCallback, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { slugify } from "@/components/flows/shared";
import { INTERACTIVE_LIMITS } from "@/lib/whatsapp/meta-api";
import { uploadAccountMedia, MEDIA_MAX_BYTES } from "@/lib/storage/upload-media";
import {
  validateInteractivePayload,
  type InteractiveButtonsPayload,
  type InteractiveListPayload,
  type InteractiveCarouselPayload,
  type InteractiveCarouselCard,
  type InteractiveMessagePayload,
} from "@/lib/whatsapp/interactive";
import { InteractivePreview } from "./interactive-preview";

// Same bucket Flows' send_media node uploads to (see node-config-form.tsx)
// — carousel cards are reusable content saved with a quick reply or a
// flow node, not a one-off chat attachment, so they share that bucket's
// semantics rather than the inbox composer's "chat-media" one.
const CAROUSEL_MEDIA_BUCKET = "flow-media";
const CAROUSEL_HEADER_ACCEPT: Record<"image" | "video", string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
};

// ------------------------------------------------------------
// Blank payload factories — used to seed a fresh builder and to
// switch kind without losing the shared body/header/footer.
// ------------------------------------------------------------

/**
 * Generate an id that doesn't collide with any already in use. A plain
 * count-based id (`btn_${length+1}`) regenerates an existing id after a
 * middle item is removed, which then trips the duplicate-id validator and
 * silently blocks sending. Increment past any taken id instead.
 */
function nextId(existing: string[], prefix: string): string {
  const taken = new Set(existing);
  let n = existing.length + 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function blankButtonsPayload(): InteractiveButtonsPayload {
  return {
    kind: "buttons",
    body: "",
    buttons: [{ id: "btn_1", title: "" }],
  };
}

export function blankListPayload(): InteractiveListPayload {
  return {
    kind: "list",
    body: "",
    button_label: "Menu",
    sections: [{ title: "", rows: [{ id: "row_1", title: "" }] }],
  };
}

function blankCarouselCard(buttonMode: "url" | "quick_reply", id: string): InteractiveCarouselCard {
  return {
    header: { type: "image", url: "" },
    body: "",
    button_label: "",
    ...(buttonMode === "url" ? { button_url: "" } : { button_id: id }),
  };
}

export function blankCarouselPayload(): InteractiveCarouselPayload {
  return {
    kind: "carousel",
    body: "",
    button_mode: "url",
    // Meta's minimum — matches how blankButtonsPayload/blankListPayload
    // each seed exactly their kind's minimum (1 button, 1 row).
    cards: [
      blankCarouselCard("url", "card_1"),
      blankCarouselCard("url", "card_2"),
    ],
  };
}

interface InteractiveBuilderProps {
  value: InteractiveMessagePayload;
  onChange: (payload: InteractiveMessagePayload) => void;
  /** Show the live WhatsApp-style preview beside the form. Default true. */
  showPreview?: boolean;
}

/**
 * Controlled builder for a WhatsApp interactive message (reply buttons
 * or list). Enforces Meta's char limits inline (maxLength + counters)
 * and surfaces a single validation error via `validateInteractivePayload`
 * — the same check the server runs before sending. Shared by the inbox
 * composer, the automation Send node, and the quick-replies manager.
 */
export function InteractiveBuilder({
  value,
  onChange,
  showPreview = true,
}: InteractiveBuilderProps) {
  const t = useTranslations("Interactive");
  const [advanced, setAdvanced] = useState(false);
  const validation = validateInteractivePayload(value);

  const setField = (patch: Partial<InteractiveMessagePayload>) =>
    onChange({ ...value, ...patch } as InteractiveMessagePayload);

  const switchKind = (kind: "buttons" | "list" | "carousel") => {
    if (kind === value.kind) return;
    // Carousel has no header/footer in Meta's payload shape (see
    // interactive.ts), so there's nothing to carry over from it.
    const shared =
      value.kind === "carousel"
        ? { body: value.body }
        : { body: value.body, header: value.header, footer: value.footer };
    onChange(
      kind === "buttons"
        ? { ...blankButtonsPayload(), ...shared }
        : kind === "list"
          ? { ...blankListPayload(), ...shared }
          : { ...blankCarouselPayload(), ...shared },
    );
  };

  return (
    // Editor and preview sit side by side only when the SPACE WE WERE
    // GIVEN can hold both — a container query, not a viewport one. This
    // builder is embedded in places far narrower than the screen (an
    // automation step card, and a step nested in a condition branch is
    // narrower still); keying the split to `md:` meant a desktop
    // viewport forced a 280px preview column into a ~190px card and the
    // whole editor overflowed (issue #474).
    <div className="@container">
      <div className="flex flex-col gap-4 @2xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Kind toggle */}
          <div className="flex gap-2">
            <KindButton
              active={value.kind === "buttons"}
              label={t("replyButtons")}
              onClick={() => switchKind("buttons")}
            />
            <KindButton
              active={value.kind === "list"}
              label={t("list")}
              onClick={() => switchKind("list")}
            />
            <KindButton
              active={value.kind === "carousel"}
              label={t("carousel")}
              onClick={() => switchKind("carousel")}
            />
          </div>

          <Field label={t("body")} counter={`${value.body.length}/${INTERACTIVE_LIMITS.bodyMaxLength}`}>
            <Textarea
              value={value.body}
              maxLength={INTERACTIVE_LIMITS.bodyMaxLength}
              onChange={(e) => setField({ body: e.target.value })}
              placeholder={t("bodyPlaceholder")}
              className="min-h-20 bg-muted text-foreground"
            />
          </Field>

          {value.kind !== "carousel" && (
            <div className="grid grid-cols-2 gap-2">
              <Field
                label={t("header")}
                counter={`${(value.header ?? "").length}/${INTERACTIVE_LIMITS.headerTextMaxLength}`}
              >
                <Input
                  value={value.header ?? ""}
                  maxLength={INTERACTIVE_LIMITS.headerTextMaxLength}
                  onChange={(e) => setField({ header: e.target.value })}
                  className="bg-muted text-foreground"
                />
              </Field>
              <Field
                label={t("footer")}
                counter={`${(value.footer ?? "").length}/${INTERACTIVE_LIMITS.footerMaxLength}`}
              >
                <Input
                  value={value.footer ?? ""}
                  maxLength={INTERACTIVE_LIMITS.footerMaxLength}
                  onChange={(e) => setField({ footer: e.target.value })}
                  className="bg-muted text-foreground"
                />
              </Field>
            </div>
          )}

          {value.kind === "buttons" ? (
            <ButtonsEditor value={value} onChange={onChange} advanced={advanced} />
          ) : value.kind === "list" ? (
            <ListEditor value={value} onChange={onChange} advanced={advanced} />
          ) : (
            <CarouselEditor value={value} onChange={onChange} advanced={advanced} />
          )}

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={advanced}
              onChange={(e) => setAdvanced(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            {t("showIds")}
          </label>

          {!validation.ok && (
            <p className="text-xs text-red-400">{validation.error}</p>
          )}
        </div>

        {showPreview && (
          <div className="flex shrink-0 flex-col gap-1.5 @2xl:w-[280px]">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("preview")}
            </span>
            <div className="rounded-lg bg-muted/40 p-3">
              <InteractivePreview
                payload={value}
                labels={{
                  body: t("previewBody"),
                  button: t("previewButton"),
                  menu: t("previewMenu"),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Buttons editor
// ------------------------------------------------------------

function ButtonsEditor({
  value,
  onChange,
  advanced,
}: {
  value: InteractiveButtonsPayload;
  onChange: (p: InteractiveMessagePayload) => void;
  advanced: boolean;
}) {
  const t = useTranslations("Interactive");
  const buttons = value.buttons;
  const update = (idx: number, patch: Partial<InteractiveButtonsPayload["buttons"][number]>) =>
    onChange({
      ...value,
      buttons: buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  const add = () =>
    onChange({
      ...value,
      buttons: [
        ...buttons,
        { id: nextId(buttons.map((b) => b.id), "btn_"), title: "" },
      ],
    });
  const remove = (idx: number) =>
    onChange({ ...value, buttons: buttons.filter((_, i) => i !== idx) });

  return (
    <div>
      <label className="mb-2 block text-xs text-muted-foreground">
        {t("buttonsCount", { count: buttons.length, max: INTERACTIVE_LIMITS.maxButtons })}
      </label>
      <div className="flex flex-col gap-2">
        {buttons.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2"
          >
            {advanced && (
              <Input
                value={b.id}
                onChange={(e) => update(i, { id: slugify(e.target.value, `btn_${i + 1}`) })}
                placeholder={t("idPlaceholder")}
                className="w-28 bg-muted font-mono text-xs"
              />
            )}
            <Input
              value={b.title}
              maxLength={INTERACTIVE_LIMITS.buttonTitleMaxLength}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={t("buttonLabelPlaceholder")}
              className="flex-1 bg-muted"
            />
            <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
              {b.title.length}/{INTERACTIVE_LIMITS.buttonTitleMaxLength}
            </span>
            {buttons.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {buttons.length < INTERACTIVE_LIMITS.maxButtons && (
        <Button variant="ghost" size="sm" onClick={add} className="mt-2">
          <Plus className="h-3.5 w-3.5" />
          {t("addButton")}
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// List editor
// ------------------------------------------------------------

function ListEditor({
  value,
  onChange,
  advanced,
}: {
  value: InteractiveListPayload;
  onChange: (p: InteractiveMessagePayload) => void;
  advanced: boolean;
}) {
  const t = useTranslations("Interactive");
  const sections = value.sections;
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  const allRowIds = () => sections.flatMap((s) => s.rows.map((r) => r.id));

  const updateSection = (sIdx: number, patch: Partial<InteractiveListPayload["sections"][number]>) =>
    onChange({
      ...value,
      sections: sections.map((s, i) => (i === sIdx ? { ...s, ...patch } : s)),
    });
  const updateRow = (
    sIdx: number,
    rIdx: number,
    patch: Partial<InteractiveListPayload["sections"][number]["rows"][number]>,
  ) =>
    onChange({
      ...value,
      sections: sections.map((s, i) =>
        i === sIdx
          ? { ...s, rows: s.rows.map((r, j) => (j === rIdx ? { ...r, ...patch } : r)) }
          : s,
      ),
    });
  const addRow = (sIdx: number) =>
    onChange({
      ...value,
      sections: sections.map((s, i) =>
        i === sIdx
          ? { ...s, rows: [...s.rows, { id: nextId(allRowIds(), "row_"), title: "" }] }
          : s,
      ),
    });
  const removeRow = (sIdx: number, rIdx: number) =>
    onChange({
      ...value,
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, rows: s.rows.filter((_, j) => j !== rIdx) } : s,
      ),
    });
  const addSection = () =>
    onChange({
      ...value,
      sections: [
        ...sections,
        { title: "", rows: [{ id: nextId(allRowIds(), "row_"), title: "" }] },
      ],
    });
  const removeSection = (sIdx: number) =>
    onChange({ ...value, sections: sections.filter((_, i) => i !== sIdx) });

  return (
    <div className="flex flex-col gap-3">
      <Field label={t("listButtonLabel")} counter={`${value.button_label.length}/${INTERACTIVE_LIMITS.buttonTitleMaxLength}`}>
        <Input
          value={value.button_label}
          maxLength={INTERACTIVE_LIMITS.buttonTitleMaxLength}
          onChange={(e) => onChange({ ...value, button_label: e.target.value })}
          className="bg-muted text-foreground"
        />
      </Field>

      <label className="block text-xs text-muted-foreground">
        {t("rowsCount", { count: totalRows, max: INTERACTIVE_LIMITS.maxListRowsTotal })}
      </label>

      {sections.map((section, sIdx) => (
        <div key={sIdx} className="rounded-md border border-border bg-muted/40 p-2">
          <div className="mb-2 flex items-center gap-2">
            <Input
              value={section.title ?? ""}
              onChange={(e) => updateSection(sIdx, { title: e.target.value })}
              placeholder={t("sectionTitlePlaceholder")}
              className="flex-1 bg-muted text-xs"
            />
            {sections.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSection(sIdx)}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {section.rows.map((row, rIdx) => (
              <div key={rIdx} className="rounded border border-border bg-card p-2">
                <div className="flex items-center gap-2">
                  {advanced && (
                    <Input
                      value={row.id}
                      onChange={(e) =>
                        updateRow(sIdx, rIdx, { id: slugify(e.target.value, `row_${rIdx + 1}`) })
                      }
                      placeholder={t("idPlaceholder")}
                      className="w-24 bg-muted font-mono text-xs"
                    />
                  )}
                  <Input
                    value={row.title}
                    maxLength={INTERACTIVE_LIMITS.listRowTitleMaxLength}
                    onChange={(e) => updateRow(sIdx, rIdx, { title: e.target.value })}
                    placeholder={t("rowTitlePlaceholder")}
                    className="flex-1 bg-muted"
                  />
                  <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                    {row.title.length}/{INTERACTIVE_LIMITS.listRowTitleMaxLength}
                  </span>
                  {totalRows > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(sIdx, rIdx)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  value={row.description ?? ""}
                  maxLength={INTERACTIVE_LIMITS.listRowDescriptionMaxLength}
                  onChange={(e) => updateRow(sIdx, rIdx, { description: e.target.value })}
                  placeholder={t("rowDescriptionPlaceholder")}
                  className="mt-2 bg-muted text-xs"
                />
              </div>
            ))}
          </div>
          {totalRows < INTERACTIVE_LIMITS.maxListRowsTotal && (
            <Button variant="ghost" size="sm" onClick={() => addRow(sIdx)} className="mt-2">
              <Plus className="h-3.5 w-3.5" />
              {t("addRow")}
            </Button>
          )}
        </div>
      ))}

      {sections.length < INTERACTIVE_LIMITS.maxListSections &&
        totalRows < INTERACTIVE_LIMITS.maxListRowsTotal && (
          <Button variant="ghost" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            {t("addSection")}
          </Button>
        )}
    </div>
  );
}

// ------------------------------------------------------------
// Carousel editor
// ------------------------------------------------------------

function CarouselEditor({
  value,
  onChange,
  advanced,
}: {
  value: InteractiveCarouselPayload;
  onChange: (p: InteractiveMessagePayload) => void;
  advanced: boolean;
}) {
  const t = useTranslations("Interactive");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  const cards = value.cards;
  const selectedIdx = Math.min(selectedIndex, cards.length - 1);
  const selected = cards[selectedIdx];

  const updateCard = (idx: number, patch: Partial<InteractiveCarouselCard>) =>
    onChange({
      ...value,
      cards: cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });

  const addCard = () => {
    if (cards.length >= INTERACTIVE_LIMITS.maxCarouselCards) return;
    const id = nextId(
      cards.map((c) => c.button_id ?? ""),
      "card_",
    );
    onChange({ ...value, cards: [...cards, blankCarouselCard(value.button_mode, id)] });
    setSelectedIndex(cards.length);
  };

  const removeCard = (idx: number) => {
    if (cards.length <= INTERACTIVE_LIMITS.minCarouselCards) return;
    onChange({ ...value, cards: cards.filter((_, i) => i !== idx) });
    setSelectedIndex((i) => Math.min(i, cards.length - 2));
  };

  // Meta requires the same button type on every card — modeled once
  // here rather than per-card (see InteractiveCarouselPayload). Switching
  // clears the field the new mode doesn't use and seeds a stable id per
  // card for quick_reply, same pattern as ButtonsEditor's button ids.
  const setButtonMode = (mode: "url" | "quick_reply") => {
    if (mode === value.button_mode) return;
    onChange({
      ...value,
      button_mode: mode,
      cards: cards.map((c, i) =>
        mode === "url"
          ? { ...c, button_url: c.button_url ?? "", button_id: undefined }
          : { ...c, button_id: c.button_id ?? `card_${i + 1}`, button_url: undefined },
      ),
    });
  };

  const handleFile = useCallback(
    async (idx: number, file: File) => {
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(t("fileTooLarge", { size: (file.size / 1024 / 1024).toFixed(1) }));
        return;
      }
      setUploading(true);
      try {
        // Same account-scoped bucket Flows' send_media node uploads to —
        // see CAROUSEL_MEDIA_BUCKET above.
        const { publicUrl } = await uploadAccountMedia(CAROUSEL_MEDIA_BUCKET, file);
        updateCard(idx, { header: { type: cards[idx].header.type, url: publicUrl } });
        toast.success(t("fileUploaded"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateCard closes over `cards`/`value` fresh each render; re-created every render is fine here, this only needs to be stable within one render.
    [cards, value, t],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-2 block text-xs text-muted-foreground">
          {t("cardsCount", { count: cards.length, max: INTERACTIVE_LIMITS.maxCarouselCards })}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((card, i) => (
            <div key={i} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border text-[10px] font-medium",
                  i === selectedIdx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {card.header.type === "video" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {t("cardN", { n: i + 1 })}
              </button>
              {cards.length > INTERACTIVE_LIMITS.minCarouselCards && (
                <button
                  type="button"
                  onClick={() => removeCard(i)}
                  aria-label={t("removeCard")}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-red-400"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {cards.length < INTERACTIVE_LIMITS.maxCarouselCards && (
            <button
              type="button"
              onClick={addCard}
              className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              <span className="text-[10px] font-medium">{t("addCard")}</span>
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("cardButtonType")}</label>
        <div className="flex gap-2">
          <KindButton
            active={value.button_mode === "url"}
            label={t("websiteLink")}
            onClick={() => setButtonMode("url")}
          />
          <KindButton
            active={value.button_mode === "quick_reply"}
            label={t("quickReply")}
            onClick={() => setButtonMode("quick_reply")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{t("cardHeaderLabel", { n: selectedIdx + 1 })}</span>
          <div className="flex gap-1.5">
            <KindButton
              active={selected.header.type === "image"}
              label={t("imageLabel")}
              onClick={() => updateCard(selectedIdx, { header: { type: "image", url: "" } })}
            />
            <KindButton
              active={selected.header.type === "video"}
              label={t("videoLabel")}
              onClick={() => updateCard(selectedIdx, { header: { type: "video", url: "" } })}
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={CAROUSEL_HEADER_ACCEPT[selected.header.type]}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(selectedIdx, file);
            e.target.value = "";
          }}
        />
        {selected.header.url ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
            {selected.header.type === "video" ? (
              <video
                src={selected.header.url}
                className="h-10 w-10 shrink-0 rounded object-cover"
                muted
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.header.url}
                alt=""
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            )}
            <a
              href={selected.header.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-foreground hover:text-primary"
            >
              {selected.header.url.split("/").pop()}
            </a>
            <button
              type="button"
              onClick={() => updateCard(selectedIdx, { header: { ...selected.header, url: "" } })}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("removeFile")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? t("uploading") : t("uploadFile")}
          </button>
        )}

        <Field
          label={t("cardBodyLabel")}
          counter={`${(selected.body ?? "").length}/${INTERACTIVE_LIMITS.carouselCardBodyMaxLength}`}
        >
          <Textarea
            value={selected.body ?? ""}
            maxLength={INTERACTIVE_LIMITS.carouselCardBodyMaxLength}
            onChange={(e) => updateCard(selectedIdx, { body: e.target.value })}
            placeholder={t("cardBodyPlaceholder")}
            className="min-h-14 bg-card text-foreground"
          />
        </Field>

        <div className="flex items-end gap-2">
          {advanced && value.button_mode === "quick_reply" && (
            <div className="w-24 shrink-0">
              <label className="mb-1 block text-xs text-muted-foreground">{t("idPlaceholder")}</label>
              <Input
                value={selected.button_id ?? ""}
                onChange={(e) =>
                  updateCard(selectedIdx, {
                    button_id: slugify(e.target.value, `card_${selectedIdx + 1}`),
                  })
                }
                className="bg-card font-mono text-xs"
              />
            </div>
          )}
          <div className="flex-1">
            <Field
              label={t("buttonLabelPlaceholder")}
              counter={`${selected.button_label.length}/${INTERACTIVE_LIMITS.buttonTitleMaxLength}`}
            >
              <Input
                value={selected.button_label}
                maxLength={INTERACTIVE_LIMITS.buttonTitleMaxLength}
                onChange={(e) => updateCard(selectedIdx, { button_label: e.target.value })}
                placeholder={t("buttonLabelPlaceholder")}
                className="bg-card"
              />
            </Field>
          </div>
        </div>

        {value.button_mode === "url" && (
          <Field label={t("cardButtonUrlLabel")}>
            <Input
              value={selected.button_url ?? ""}
              onChange={(e) => updateCard(selectedIdx, { button_url: e.target.value })}
              placeholder={t("cardButtonUrlPlaceholder")}
              className="bg-card"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Small presentational helpers
// ------------------------------------------------------------

function KindButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  counter,
  children,
}: {
  label: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        {counter && <span className="text-[10px] text-muted-foreground">{counter}</span>}
      </div>
      {children}
    </div>
  );
}
