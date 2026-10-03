"use client";

/**
 * Per-node configuration form, dispatched by node_type.
 *
 * One component, ten branches. Each branch renders the inputs that
 * map onto the node's `config` JSONB shape (text + buttons for
 * send_buttons, prompt + var_key for collect_input, etc.) and forwards
 * edits up via `onUpdateConfig`.
 *
 * Why this lives in src/components/flows/forms/ instead of next to
 * the list editor: PR 2 (canvas editing) needs to mount the same
 * form in a side panel when a user clicks a node on the canvas.
 * Keeping the per-node forms here means there's exactly one place
 * where each form's behaviour and validation lives — drift between
 * "what the list editor shows" and "what the canvas side panel
 * shows" becomes impossible.
 *
 * `showAdvanced` is the disclosure that surfaces internal
 * identifiers (node_key, button reply_id, list row reply_id) — owned
 * by the host (NodeCard / SideSheet) so the toggle is rendered
 * outside this form alongside whatever delete/cancel buttons that
 * host wants. The form just reads the boolean and conditionally
 * renders the advanced rows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { uploadAccountMedia, MEDIA_MAX_BYTES } from "@/lib/storage/upload-media";
import type { InteractiveCarouselPayload } from "@/lib/whatsapp/interactive";
import type { QuickReply } from "@/types";
import { slugify, type BuilderNode } from "../shared";
import { NextNodeRow, NodeKeySelect, TextRow, WarningNote } from "./fields";

interface NodeConfigFormProps {
  node: BuilderNode;
  allNodes: BuilderNode[];
  showAdvanced: boolean;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

export function NodeConfigForm({
  node,
  allNodes,
  showAdvanced,
  onUpdateConfig,
}: NodeConfigFormProps) {
  const t = useTranslations("Flows.builder.form");
  const cfg = node.config;
  switch (node.node_type) {
    case "start":
      return (
        <NextNodeRow
          value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
          allNodes={allNodes}
          currentKey={node.node_key}
          onChange={(v) => onUpdateConfig({ next_node_key: v })}
          label={t("advancesTo")}
        />
      );

    case "send_message":
      return (
        <>
          <TextRow
            label={t("textToCustomer")}
            value={(cfg as { text?: string }).text ?? ""}
            onChange={(v) => onUpdateConfig({ text: v })}
            rows={3}
          />
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label={t("advancesTo")}
          />
        </>
      );

    case "send_buttons":
      return (
        <SendButtonsForm
          cfg={cfg as SendButtonsCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
          t={t}
        />
      );

    case "send_list":
      return (
        <SendListForm
          cfg={cfg as SendListCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
          t={t}
        />
      );

    case "send_carousel":
      return (
        <SendCarouselForm
          // Remounts fresh (mode/loadedFrom/selectedIndex) when the user
          // switches to a different Send Carousel node in the same flow —
          // without this key, React reuses the instance across nodes.
          key={node.node_key}
          cfg={cfg as SendCarouselCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
          t={t}
        />
      );

    case "send_media":
      return (
        <SendMediaForm
          cfg={cfg as SendMediaCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "send_catalog":
      return (
        <>
          <TextRow
            label={t("bodyText")}
            value={(cfg as { body?: string }).body ?? ""}
            onChange={(v) => onUpdateConfig({ body: v })}
            rows={3}
          />
          <TextRow
            label={t("footerText")}
            value={(cfg as { footer?: string }).footer ?? ""}
            onChange={(v) => onUpdateConfig({ footer: v })}
          />
          <p className="text-[11px] text-muted-foreground">{t("catalogHelp")}</p>
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label={t("advancesTo")}
          />
        </>
      );

    case "send_template":
      return (
        <SendTemplateForm
          cfg={cfg as SendTemplateCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "wait_followup":
      return (
        <WaitFollowupForm
          cfg={cfg as WaitFollowupCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "collect_input":
      return (
        <>
          <TextRow
            label={t("promptToCustomer")}
            value={(cfg as { prompt_text?: string }).prompt_text ?? ""}
            onChange={(v) => onUpdateConfig({ prompt_text: v })}
            rows={2}
          />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("varKeyLabel")}
            </label>
            <Input
              value={(cfg as { var_key?: string }).var_key ?? ""}
              onChange={(e) =>
                onUpdateConfig({
                  var_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                })
              }
              placeholder={t("varKeyPlaceholder")}
              className="bg-muted font-mono text-xs"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("varKeyHelp")}{" "}
              <code className="rounded bg-muted px-1">
                {"{{vars."}
                {(cfg as { var_key?: string }).var_key || "name"}
                {"}}"}
              </code>
              .
            </p>
          </div>
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label={t("advanceAfterCapture")}
          />
        </>
      );

    case "condition":
      return (
        <ConditionForm
          cfg={cfg as ConditionCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "set_tag":
      return (
        <SetTagForm
          cfg={cfg as SetTagCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "ai_agent":
      return (
        <AiAgentForm
          cfg={cfg as AiAgentCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          t={t}
        />
      );

    case "handoff":
      return (
        <TextRow
          label={t("internalNote")}
          value={(cfg as { note?: string }).note ?? ""}
          onChange={(v) => onUpdateConfig({ note: v })}
          rows={2}
        />
      );

    case "end":
      return (
        <p className="text-xs text-muted-foreground">
          {t("endNodeHelp")}
        </p>
      );
  }
}

// ============================================================
// send_buttons
// ============================================================

interface SendButtonsCfg {
  text?: string;
  footer_text?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key: string }>;
}

function SendButtonsForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
  t,
}: {
  cfg: SendButtonsCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const buttons = cfg.buttons ?? [];
  const updateButton = (
    idx: number,
    patch: Partial<NonNullable<SendButtonsCfg["buttons"]>[number]>,
  ) => {
    onUpdateConfig({
      buttons: buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };
  const addButton = () =>
    onUpdateConfig({
      buttons: [
        ...buttons,
        {
          reply_id: `btn_${buttons.length + 1}`,
          title: t("defaultOptionTitle"),
          next_node_key: "",
        },
      ],
    });
  const removeButton = (idx: number) =>
    onUpdateConfig({ buttons: buttons.filter((_, i) => i !== idx) });

  return (
    <>
      <TextRow
        label={t("bodyText")}
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <TextRow
        label={t("footerText")}
        value={cfg.footer_text ?? ""}
        onChange={(v) => onUpdateConfig({ footer_text: v })}
      />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            {t("buttonsHelp")}
          </label>
        </div>
        <div className="flex flex-col gap-3">
          {buttons.map((b, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3",
                showAdvanced
                  ? "md:grid-cols-[1fr_2fr_2fr_auto]"
                  : "md:grid-cols-[2fr_2fr_auto]",
              )}
            >
              {showAdvanced && (
                <Input
                  value={b.reply_id}
                  onChange={(e) =>
                    updateButton(i, {
                      reply_id: slugify(e.target.value, `btn_${i + 1}`),
                    })
                  }
                  placeholder="reply_id"
                  className="bg-muted font-mono text-xs"
                />
              )}
              <Input
                value={b.title}
                onChange={(e) => updateButton(i, { title: e.target.value })}
                placeholder={t("optionTitlePlaceholder")}
                className="bg-muted"
                maxLength={20}
              />
              <NodeKeySelect
                value={b.next_node_key || null}
                nodes={allNodes}
                excludeKey={currentKey}
                onChange={(v) => updateButton(i, { next_node_key: v ?? "" })}
                placeholder={t("nextNodePlaceholder")}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeButton(i)}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {buttons.length < 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addButton}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addButton")}
          </Button>
        )}
      </div>
    </>
  );
}

// ============================================================
// send_list
// ============================================================

interface SendListCfg {
  text?: string;
  button_label?: string;
  footer_text?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{
      reply_id: string;
      title: string;
      description?: string;
      next_node_key: string;
    }>;
  }>;
}

function SendListForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
  t,
}: {
  cfg: SendListCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const sections = cfg.sections ?? [];
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  const updateSection = (
    sIdx: number,
    patch: Partial<NonNullable<SendListCfg["sections"]>[number]>,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, ...patch } : s,
      ),
    });
  };
  const addSection = () =>
    onUpdateConfig({
      sections: [
        ...sections,
        {
          title: "",
          rows: [
            {
              reply_id: `row_${totalRows + 1}`,
              title: `Option ${totalRows + 1}`,
              next_node_key: "",
            },
          ],
        },
      ],
    });
  const removeSection = (sIdx: number) =>
    onUpdateConfig({ sections: sections.filter((_, i) => i !== sIdx) });
  const updateRow = (
    sIdx: number,
    rIdx: number,
    patch: Partial<
      NonNullable<SendListCfg["sections"]>[number]["rows"][number]
    >,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: s.rows.map((r, j) => (j === rIdx ? { ...r, ...patch } : r)),
            }
          : s,
      ),
    });
  };
  const addRow = (sIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: [
                ...s.rows,
                {
                  reply_id: `row_${totalRows + 1}`,
                  title: `Option ${totalRows + 1}`,
                  next_node_key: "",
                },
              ],
            }
          : s,
      ),
    });
  const removeRow = (sIdx: number, rIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, rows: s.rows.filter((_, j) => j !== rIdx) } : s,
      ),
    });

  return (
    <>
      <TextRow
        label={t("bodyText")}
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextRow
          label={t("buttonLabel")}
          value={cfg.button_label ?? ""}
          onChange={(v) => onUpdateConfig({ button_label: v })}
        />
        <TextRow
          label={t("footerText")}
          value={cfg.footer_text ?? ""}
          onChange={(v) => onUpdateConfig({ footer_text: v })}
        />
      </div>

      <div className="mt-2">
        <label className="mb-2 block text-xs text-muted-foreground">
          {t("rowsHelp")}
        </label>
        {sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="mb-3 rounded-md border border-border bg-muted/40 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={section.title ?? ""}
                onChange={(e) =>
                  updateSection(sIdx, { title: e.target.value })
                }
                placeholder={t("sectionTitlePlaceholder", { count: sIdx + 1 })}
                className="bg-muted text-xs"
              />
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSection(sIdx)}
                  className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  aria-label={t("removeSection")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {section.rows.map((row, rIdx) => (
              <div
                key={rIdx}
                className={cn(
                  "mb-2 grid grid-cols-1 gap-2",
                  showAdvanced
                    ? "md:grid-cols-[1fr_2fr_2fr_auto]"
                    : "md:grid-cols-[2fr_2fr_auto]",
                )}
              >
                {showAdvanced && (
                  <Input
                    value={row.reply_id}
                    onChange={(e) =>
                      updateRow(sIdx, rIdx, {
                        reply_id: slugify(
                          e.target.value,
                          `row_${rIdx + 1}`,
                        ),
                      })
                    }
                    placeholder="reply_id"
                    className="bg-muted font-mono text-xs"
                  />
                )}
                <Input
                  value={row.title}
                  onChange={(e) =>
                    updateRow(sIdx, rIdx, { title: e.target.value })
                  }
                  placeholder={t("rowTitlePlaceholder")}
                  className="bg-muted"
                  maxLength={24}
                />
                <NodeKeySelect
                  value={row.next_node_key || null}
                  nodes={allNodes}
                  excludeKey={currentKey}
                  onChange={(v) =>
                    updateRow(sIdx, rIdx, { next_node_key: v ?? "" })
                  }
                  placeholder={t("nextNodePlaceholder")}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(sIdx, rIdx)}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {totalRows < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addRow(sIdx)}
                className="mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addRow")}
              </Button>
            )}
          </div>
        ))}
        {/* WhatsApp's interactive-list spec caps sections at 10. Group rows
            by category (Billing / Support / Sales etc.) to give customers a
            scannable menu. */}
        {sections.length < 10 && (
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            {t("addSection")}
          </Button>
        )}
      </div>
    </>
  );
}

// ============================================================
// condition
// ============================================================

interface ConditionCfg {
  subject?: "var" | "tag" | "contact_field";
  subject_key?: string;
  operator?: "equals" | "contains" | "present" | "absent";
  value?: string;
  true_next?: string;
  false_next?: string;
}

interface UserTag {
  id: string;
  name: string;
  color?: string;
}

function ConditionForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: ConditionCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tags = useUserTags();

  const subject = cfg.subject ?? "var";
  const operator = cfg.operator ?? "equals";
  const showValue = operator === "equals" || operator === "contains";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("ifLabel")}</label>
          <Select
            value={subject}
            onValueChange={(v) =>
              onUpdateConfig({ subject: v as ConditionCfg["subject"] })
            }
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="var">{t("capturedVariable")}</SelectItem>
              <SelectItem value="tag">{t("contactHasTag")}</SelectItem>
              <SelectItem value="contact_field">{t("contactField")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">
            {subject === "var"
              ? t("varName")
              : subject === "tag"
                ? t("tagLabel")
                : t("fieldLabel")}
          </label>
          {subject === "tag" && tags.length > 0 ? (
            <Select
              value={cfg.subject_key ?? ""}
              onValueChange={(v) => onUpdateConfig({ subject_key: v })}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder={t("pickTag")} />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : subject === "contact_field" ? (
            <Select
              value={cfg.subject_key ?? ""}
              onValueChange={(v) => onUpdateConfig({ subject_key: v })}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder={t("pickField")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">name</SelectItem>
                <SelectItem value="email">email</SelectItem>
                <SelectItem value="phone">phone</SelectItem>
                <SelectItem value="company">company</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={cfg.subject_key ?? ""}
              onChange={(e) =>
                onUpdateConfig({ subject_key: e.target.value })
              }
              placeholder={subject === "var" ? t("varKeyPlaceholder") : t("tagUuidPlaceholder")}
              className="bg-muted font-mono text-xs"
            />
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          showValue ? "md:grid-cols-2" : "",
        )}
      >
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("operatorLabel")}</label>
          <Select
            value={operator}
            onValueChange={(v) =>
              onUpdateConfig({ operator: v as ConditionCfg["operator"] })
            }
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="present">{t("isPresent")}</SelectItem>
              <SelectItem value="absent">{t("isAbsent")}</SelectItem>
              <SelectItem value="equals">{t("equals")}</SelectItem>
              <SelectItem value="contains">{t("contains")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {showValue && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("valueLabel")}</label>
            <Input
              value={cfg.value ?? ""}
              onChange={(e) => onUpdateConfig({ value: e.target.value })}
              className="bg-muted"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NextNodeRow
          value={cfg.true_next ?? ""}
          allNodes={allNodes}
          currentKey={currentKey}
          onChange={(v) => onUpdateConfig({ true_next: v })}
          label={t("ifTrueAdvance")}
        />
        <NextNodeRow
          value={cfg.false_next ?? ""}
          allNodes={allNodes}
          currentKey={currentKey}
          onChange={(v) => onUpdateConfig({ false_next: v })}
          label={t("ifFalseAdvance")}
        />
      </div>
    </>
  );
}

// ============================================================
// set_tag
// ============================================================

interface SetTagCfg {
  mode?: "add" | "remove";
  tag_id?: string;
  next_node_key?: string;
}

function SetTagForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: SetTagCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const tags = useUserTags();

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("actionLabel")}</label>
          <Select
            value={cfg.mode ?? "add"}
            onValueChange={(v) =>
              onUpdateConfig({ mode: v as SetTagCfg["mode"] })
            }
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">{t("addTag")}</SelectItem>
              <SelectItem value="remove">{t("removeTag")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("tagLabel")}</label>
          {tags.length > 0 ? (
            <Select
              value={cfg.tag_id ?? ""}
              onValueChange={(v) => onUpdateConfig({ tag_id: v })}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder={t("pickTag")} />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={cfg.tag_id ?? ""}
              onChange={(e) => onUpdateConfig({ tag_id: e.target.value })}
              placeholder={t("tagUuidPlaceholder")}
              className="bg-muted font-mono text-xs"
            />
          )}
        </div>
      </div>
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label={t("thenAdvanceTo")}
      />
    </>
  );
}

/**
 * Shared loader for both `condition` (subject=tag) and `set_tag`.
 * Falls back to raw UUID input if the endpoint is absent on older
 * deployments — the form remains authorable in that case.
 */
function useUserTags(): UserTag[] {
  const [tags, setTags] = useState<UserTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tags").catch(() => null);
        if (!res || !res.ok) return;
        const json = (await res.json()) as { tags?: UserTag[] };
        if (!cancelled) setTags(json.tags ?? []);
      } catch {
        // Tags endpoint absent — caller falls back to raw input.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return tags;
}

// ============================================================
// send_template
// ============================================================

interface SendTemplateCfg {
  template_name?: string;
  language?: string;
  next_node_key?: string;
}

interface ApprovedTemplate {
  name: string;
  language: string;
}

function SendTemplateForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: SendTemplateCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const templates = useApprovedTemplates();
  const templateName = cfg.template_name ?? "";
  const language = cfg.language ?? "";
  const toValue = (name: string, lang: string) => `${name}::${lang}`;
  // Radix's Select decides controlled-vs-uncontrolled from whether `value`
  // is defined on the FIRST render — passing `undefined` while nothing is
  // picked yet, then a real string once one is, trips its "switched from
  // uncontrolled to controlled" warning. `NodeKeySelect` (./fields.tsx)
  // avoids this with a stable non-undefined sentinel; mirrored here.
  const NONE = "__none__";
  const current = templateName ? toValue(templateName, language) : NONE;
  const hasMatch = templates.some((tpl) => toValue(tpl.name, tpl.language) === current);

  return (
    <>
      {templates.length === 0 ? (
        <>
          <p className="text-[11px] text-muted-foreground">
            {t("templateNoneSynced")}
          </p>
          <TextRow
            label={t("templateNameLabel")}
            value={templateName}
            onChange={(v) => onUpdateConfig({ template_name: v })}
          />
          <TextRow
            label={t("templateLanguageLabel")}
            value={language}
            onChange={(v) => onUpdateConfig({ language: v })}
          />
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("templatePickerLabel")}
          </label>
          <Select
            value={current}
            onValueChange={(v) => {
              if (!v || v === NONE) return;
              const [name, lang] = v.split("::");
              onUpdateConfig({ template_name: name ?? "", language: lang ?? "" });
            }}
          >
            <SelectTrigger className="bg-muted">
              <SelectValue placeholder={t("templatePickPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {templates.map((tpl) => (
                <SelectItem
                  key={toValue(tpl.name, tpl.language)}
                  value={toValue(tpl.name, tpl.language)}
                >
                  {tpl.name} ({tpl.language})
                </SelectItem>
              ))}
              {templateName && !hasMatch && (
                <SelectItem value={current}>
                  {t("templateUnknownOption", { name: templateName, lang: language || "?" })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label={t("advanceAfterTemplate")}
      />
    </>
  );
}

/**
 * Approved WhatsApp templates for the picker above. Same source table
 * and `status = 'APPROVED'` filter as the Automations builder's
 * template picker — queried directly (no REST endpoint exists for
 * this list yet) since RLS already scopes `message_templates` to the
 * caller's account.
 */
function useApprovedTemplates(): ApprovedTemplate[] {
  const [templates, setTemplates] = useState<ApprovedTemplate[]>([]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("name, language")
        .eq("status", "APPROVED")
        .order("name");
      if (!cancelled) setTemplates((data as ApprovedTemplate[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return templates;
}

// ============================================================
// wait_followup
// ============================================================

interface WaitFollowupCfg {
  wait_minutes?: number;
  followup_text?: string;
  next_node_key?: string;
}

function WaitFollowupForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: WaitFollowupCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {t("waitMinutesLabel")}
        </label>
        <Input
          type="number"
          min={5}
          max={1380}
          value={cfg.wait_minutes ?? 120}
          onChange={(e) => {
            const raw = Number(e.target.value);
            onUpdateConfig({
              wait_minutes: Number.isFinite(raw) ? raw : 0,
            });
          }}
          className="bg-muted w-28"
        />
      </div>
      <WarningNote>{t("waitMinutesWarning")}</WarningNote>
      <TextRow
        label={t("followupTextLabel")}
        value={cfg.followup_text ?? ""}
        onChange={(v) => onUpdateConfig({ followup_text: v })}
        rows={3}
      />
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label={t("thenAdvanceTo")}
      />
    </>
  );
}

// ============================================================
// ai_agent
// ============================================================

interface AiAgentCfg {
  prompt?: string;
  use_knowledge_base?: boolean;
  next_node_key?: string;
  followup_wait_minutes?: number;
}

function AiAgentForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: AiAgentCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const stayInCharge = !!cfg.followup_wait_minutes;
  return (
    <>
      <TextRow
        label={t("aiInstructions")}
        value={cfg.prompt ?? ""}
        onChange={(v) => onUpdateConfig({ prompt: v })}
        rows={4}
      />
      <p className="-mt-2 text-[11px] text-muted-foreground">
        {t("aiInstructionsHint")}
      </p>
      <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
        <div>
          <p className="text-xs font-medium text-foreground">
            {t("aiUseKnowledgeBase")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("aiUseKnowledgeBaseHint")}
          </p>
        </div>
        <Switch
          checked={cfg.use_knowledge_base ?? true}
          onCheckedChange={(v) => onUpdateConfig({ use_knowledge_base: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg bg-muted p-3">
        <div>
          <p className="text-xs font-medium text-foreground">
            {t("aiStayInCharge")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("aiStayInChargeHint")}
          </p>
        </div>
        <Switch
          checked={stayInCharge}
          onCheckedChange={(v) =>
            onUpdateConfig({ followup_wait_minutes: v ? 5 : 0 })
          }
        />
      </div>
      {stayInCharge && (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("waitMinutesLabel")}
            </label>
            <Input
              type="number"
              min={5}
              max={1380}
              value={cfg.followup_wait_minutes ?? 5}
              onChange={(e) => {
                const raw = Number(e.target.value);
                onUpdateConfig({
                  followup_wait_minutes: Number.isFinite(raw) ? raw : 0,
                });
              }}
              className="bg-muted w-28"
            />
          </div>
          <WarningNote>{t("waitMinutesWarning")}</WarningNote>
        </>
      )}
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label={t("thenAdvanceTo")}
      />
    </>
  );
}

// ============================================================
// send_carousel
// ============================================================

interface SendCarouselCfg {
  body?: string;
  button_mode?: "url" | "quick_reply";
  cards?: Array<{
    header_type?: "image" | "video";
    header_url?: string;
    body?: string;
    button_label?: string;
    button_url?: string;
    reply_id?: string;
    next_node_key?: string;
  }>;
  /** Auto-advance target, url mode only — see SendCarouselNodeConfig's
   *  doc comment in types.ts. */
  next_node_key?: string;
}

const CAROUSEL_MIN_CARDS = 2;
const CAROUSEL_MAX_CARDS = 10;
const CAROUSEL_HEADER_ACCEPT: Record<"image" | "video", string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
};
const CAROUSEL_MEDIA_BUCKET = "flow-media";

function blankCarouselCard(
  buttonMode: "url" | "quick_reply",
  id: string,
): NonNullable<SendCarouselCfg["cards"]>[number] {
  return {
    header_type: "image",
    header_url: "",
    body: "",
    button_label: "",
    ...(buttonMode === "url" ? { button_url: "" } : { reply_id: id, next_node_key: "" }),
  };
}

// One-time copy from a saved carousel Quick Reply into this node's config
// shape. Flattens `header.{type,url}` -> `header_type`/`header_url`, and
// renames `button_id` -> `reply_id` (same webhook-echo role, different key
// name between the two payload shapes). `next_node_key` has no Quick Reply
// equivalent — left blank for the user to fill in, same as a fresh card.
function carouselPayloadToCards(payload: InteractiveCarouselPayload) {
  return {
    body: payload.body,
    button_mode: payload.button_mode,
    cards: payload.cards.map((c) => ({
      header_type: c.header.type,
      header_url: c.header.url,
      body: c.body ?? "",
      button_label: c.button_label,
      ...(payload.button_mode === "url"
        ? { button_url: c.button_url ?? "" }
        : { reply_id: c.button_id ?? "", next_node_key: "" }),
    })),
    ...(payload.button_mode === "url" ? { next_node_key: "" } : {}),
  };
}

function SendCarouselForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
  t,
}: {
  cfg: SendCarouselCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"build" | "load">("build");
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);

  const cards = cfg.cards ?? [];
  const buttonMode = cfg.button_mode ?? "url";
  const selectedIdx = cards.length > 0 ? Math.min(selectedIndex, cards.length - 1) : 0;
  const selected = cards[selectedIdx];

  const updateCard = (
    idx: number,
    patch: Partial<NonNullable<SendCarouselCfg["cards"]>[number]>,
  ) =>
    onUpdateConfig({
      cards: cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });

  const addCard = () => {
    if (cards.length >= CAROUSEL_MAX_CARDS) return;
    onUpdateConfig({
      cards: [...cards, blankCarouselCard(buttonMode, `card_${cards.length + 1}`)],
    });
    setSelectedIndex(cards.length);
  };

  const removeCard = (idx: number) => {
    if (cards.length <= CAROUSEL_MIN_CARDS) return;
    onUpdateConfig({ cards: cards.filter((_, i) => i !== idx) });
    setSelectedIndex((i) => Math.min(i, cards.length - 2));
  };

  // Meta requires the same button type on every card — modeled once
  // here rather than per-card, same reasoning as the shared
  // InteractiveBuilder's carousel editor (interactive-builder.tsx).
  const setButtonMode = (mode: "url" | "quick_reply") => {
    if (mode === buttonMode) return;
    onUpdateConfig({
      button_mode: mode,
      cards: cards.map((c, i) =>
        mode === "url"
          ? { ...c, button_url: c.button_url ?? "", reply_id: undefined, next_node_key: undefined }
          : {
              ...c,
              reply_id: c.reply_id ?? `card_${i + 1}`,
              next_node_key: c.next_node_key ?? "",
              button_url: undefined,
            },
      ),
      ...(mode === "url" ? { next_node_key: cfg.next_node_key ?? "" } : {}),
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
        // Same account-scoped bucket send_media uploads to above.
        const { publicUrl } = await uploadAccountMedia(CAROUSEL_MEDIA_BUCKET, file);
        updateCard(idx, { header_url: publicUrl });
        toast.success(t("fileUploaded"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("uploadFailed"));
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateCard closes over `cards` fresh each render; recreated every render is fine, this only needs to be stable within one.
    [cards, t],
  );

  const tabButtonClass = (active: boolean) =>
    cn(
      "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-muted text-muted-foreground hover:text-foreground",
    );

  const tabs = (
    <div className="flex gap-2">
      <button type="button" onClick={() => setMode("build")} className={tabButtonClass(mode === "build")}>
        {t("buildFromScratch")}
      </button>
      <button type="button" onClick={() => setMode("load")} className={tabButtonClass(mode === "load")}>
        {t("loadSavedCarousel")}
      </button>
    </div>
  );

  if (mode === "load") {
    return (
      <>
        {tabs}
        <SavedCarouselPicker
          t={t}
          onPick={(payload, title) => {
            onUpdateConfig(carouselPayloadToCards(payload));
            setLoadedFrom(title);
            setMode("build");
          }}
        />
      </>
    );
  }

  if (!selected) return null;

  return (
    <>
      {tabs}
      {loadedFrom && (
        <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-2.5 py-2 text-xs text-primary">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {t("loadedFromQuickReply", { title: loadedFrom })}
          </span>
          <button
            type="button"
            onClick={() => setMode("load")}
            className="shrink-0 font-semibold underline decoration-primary/50 underline-offset-2"
          >
            {t("changeSource")}
          </button>
        </div>
      )}
      <TextRow
        label={t("bodyText")}
        value={cfg.body ?? ""}
        onChange={(v) => onUpdateConfig({ body: v })}
        rows={2}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("cardButtonType")}</label>
          <Select value={buttonMode} onValueChange={(v) => setButtonMode(v as "url" | "quick_reply")}>
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="url">{t("websiteLink")}</SelectItem>
              <SelectItem value="quick_reply">{t("quickReply")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {buttonMode === "url" && (
          <NextNodeRow
            value={cfg.next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={currentKey}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label={t("advancesTo")}
          />
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs text-muted-foreground">
          {t("cardsCount", { count: cards.length, max: CAROUSEL_MAX_CARDS })}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cards.map((c, i) => (
            <div key={i} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-md border text-[10px] font-medium",
                  i === selectedIdx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {t("cardN", { n: i + 1 })}
              </button>
              {cards.length > CAROUSEL_MIN_CARDS && (
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
          {cards.length < CAROUSEL_MAX_CARDS && (
            <button
              type="button"
              onClick={addCard}
              aria-label={t("addCard")}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              {t("cardHeaderLabel", { n: selectedIdx + 1 })}
            </label>
            <Select
              value={selected.header_type ?? "image"}
              onValueChange={(v) =>
                updateCard(selectedIdx, { header_type: v as "image" | "video", header_url: "" })
              }
            >
              <SelectTrigger className="bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">{t("imageLabel")}</SelectItem>
                <SelectItem value="video">{t("videoLabel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t("fileLabel")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept={CAROUSEL_HEADER_ACCEPT[selected.header_type ?? "image"]}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(selectedIdx, file);
                e.target.value = "";
              }}
            />
            {selected.header_url ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                <a
                  href={selected.header_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-foreground hover:text-cyan-300"
                  title={selected.header_url}
                >
                  {selected.header_url.split("/").pop()}
                </a>
                <button
                  type="button"
                  onClick={() => updateCard(selectedIdx, { header_url: "" })}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("removeFile")}
                  disabled={uploading}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? t("uploading") : t("clickToUpload")}
              </button>
            )}
          </div>
        </div>

        <TextRow
          label={t("cardBodyLabel")}
          value={selected.body ?? ""}
          onChange={(v) => updateCard(selectedIdx, { body: v })}
          rows={2}
        />

        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            showAdvanced && buttonMode === "quick_reply"
              ? "md:grid-cols-[1fr_2fr]"
              : "md:grid-cols-2",
          )}
        >
          {showAdvanced && buttonMode === "quick_reply" && (
            <Input
              value={selected.reply_id ?? ""}
              onChange={(e) =>
                updateCard(selectedIdx, {
                  reply_id: slugify(e.target.value, `card_${selectedIdx + 1}`),
                })
              }
              placeholder="reply_id"
              className="bg-muted font-mono text-xs"
            />
          )}
          <Input
            value={selected.button_label ?? ""}
            onChange={(e) => updateCard(selectedIdx, { button_label: e.target.value })}
            placeholder={t("optionTitlePlaceholder")}
            maxLength={20}
            className="bg-card"
          />
          {buttonMode === "url" ? (
            <Input
              value={selected.button_url ?? ""}
              onChange={(e) => updateCard(selectedIdx, { button_url: e.target.value })}
              placeholder={t("cardButtonUrlPlaceholder")}
              className="bg-card"
            />
          ) : (
            <NodeKeySelect
              value={selected.next_node_key || null}
              nodes={allNodes}
              excludeKey={currentKey}
              onChange={(v) => updateCard(selectedIdx, { next_node_key: v ?? "" })}
              placeholder={t("nextNodePlaceholder")}
            />
          )}
        </div>
      </div>
    </>
  );
}

// Lists the account's saved carousel-kind Quick Replies so a Send
// Carousel node can be pre-filled instead of built from scratch. Reuses
// the same fetch-all, filter-client-side approach as the inbox's
// QuickReplyPicker (quick-reply-picker.tsx) — no server-side filter
// param exists, and the list is small enough that it doesn't need one.
function SavedCarouselPicker({
  t,
  onPick,
}: {
  t: ReturnType<typeof useTranslations>;
  onPick: (payload: InteractiveCarouselPayload, title: string) => void;
}) {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/quick-replies", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setItems((data.quick_replies as QuickReply[]) ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const carousels = items.filter(
    (qr): qr is QuickReply & { interactive_payload: InteractiveCarouselPayload } =>
      qr.kind === "interactive" && qr.interactive_payload?.kind === "carousel",
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (carousels.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">{t("savedCarouselsEmpty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {carousels.map((qr) => {
        const payload = qr.interactive_payload;
        const firstCard = payload.cards[0];
        return (
          <button
            key={qr.id}
            type="button"
            onClick={() => onPick(payload, qr.title)}
            className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted"
          >
            {firstCard?.header.type === "image" && firstCard.header.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={firstCard.header.url} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Video className="h-4 w-4" />
              </div>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{qr.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("carouselCardsMeta", {
                  count: payload.cards.length,
                  buttonType: payload.button_mode === "url" ? t("websiteLink") : t("quickReply"),
                })}
              </span>
            </span>
            <Zap className="h-4 w-4 shrink-0 text-primary" />
          </button>
        );
      })}
      <p className="mt-1 text-[11px] text-muted-foreground">{t("loadCarouselHint")}</p>
    </div>
  );
}

// ============================================================
// send_media
// ============================================================

interface SendMediaCfg {
  media_type?: "image" | "video" | "document";
  media_url?: string;
  caption?: string;
  filename?: string;
  next_node_key?: string;
}

// Mirrors the bucket's allowed_mime_types from migration 016. Kept in
// sync with the storage policy so the picker rejects unsupported files
// before they hit the network rather than failing with a confusing
// Supabase RLS / mime-type error.
const MEDIA_ACCEPT: Record<NonNullable<SendMediaCfg["media_type"]>, string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
};

const FLOW_MEDIA_BUCKET = "flow-media";

function SendMediaForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  t,
}: {
  cfg: SendMediaCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mediaType = cfg.media_type ?? "image";
  const isDocument = mediaType === "document";
  const displayName =
    cfg.filename ||
    (cfg.media_url ? cfg.media_url.split("/").pop() ?? "" : "");

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(
          t("fileTooLarge", { size: (file.size / 1024 / 1024).toFixed(1) }),
        );
        return;
      }
      setUploading(true);
      try {
        // Account-scoped upload (path `account-<id>/...`) — see
        // uploadAccountMedia + migration 020's flow-media RLS policy.
        const { publicUrl } = await uploadAccountMedia(FLOW_MEDIA_BUCKET, file);
        // Patch all fields in one call so the form doesn't re-render
        // with a half-uploaded state.
        onUpdateConfig({
          media_url: publicUrl,
          filename: file.name,
        });
        toast.success(t("fileUploaded"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("uploadFailed");
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUpdateConfig, t],
  );

  const handleClear = () => {
    onUpdateConfig({ media_url: "", filename: "" });
  };

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("mediaTypeLabel")}</label>
        <Select
          value={mediaType}
          onValueChange={(v) => {
            // Changing type clears the existing file — the bucket
            // accepts different MIME sets per type and a previously
            // uploaded PDF can't be sent as an image.
            onUpdateConfig({
              media_type: v as NonNullable<SendMediaCfg["media_type"]>,
              media_url: "",
              filename: "",
            });
          }}
        >
          <SelectTrigger className="bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">{t("imageLabel")}</SelectItem>
            <SelectItem value="video">{t("videoLabel")}</SelectItem>
            <SelectItem value="document">
              {t("documentLabel")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">{t("fileLabel")}</label>
        {cfg.media_url ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <a
              href={cfg.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-foreground hover:text-cyan-300"
              title={displayName || cfg.media_url}
            >
              {displayName || cfg.media_url}
            </a>
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("removeFile")}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("uploading")}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                {t("clickToUpload")}
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT[mediaType]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      <TextRow
        label={t("captionLabel")}
        value={cfg.caption ?? ""}
        onChange={(v) => onUpdateConfig({ caption: v })}
        rows={2}
      />

      {isDocument && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("filenameLabel")}
          </label>
          <Input
            value={cfg.filename ?? ""}
            onChange={(e) => onUpdateConfig({ filename: e.target.value })}
            placeholder={t("filenamePlaceholder")}
            className="bg-muted text-xs"
          />
        </div>
      )}

      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label={t("advanceAfterSending")}
      />
    </>
  );
}
