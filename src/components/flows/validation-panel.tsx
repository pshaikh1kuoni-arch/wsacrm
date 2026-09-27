"use client";

/**
 * Validation panel — surfaces every error and warning from
 * `validateFlowForActivation`. Lives once at the bottom of the
 * editor shell so it's visible in both views (canvas + list).
 *
 * Node-scoped issues are clickable: tapping one calls
 * `requestFlash(node_key)` on the editor context. List view's
 * useEffect on `flashKey` expands + scrolls + flashes the row;
 * canvas view's useEffect pans the viewport + flashes the card.
 * Both views read the same flashKey so the panel doesn't need
 * per-view plumbing.
 *
 * Trigger-scoped issues are NOT clickable from canvas — trigger
 * config is a list-only panel (it's a flat form, not a graph
 * concept). User can switch to List to address them.
 */

import { useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/lib/flows/validate";
import { CANVAS_MUTED_TEXT } from "./shared";
import { useFlowEditor } from "./flow-editor-state";

/**
 * `floating`: canvas view renders this pinned over the stage (collapsed
 * pill by default, click to expand a capped, scrollable list) so a long
 * flow's warnings never grow the layout or push the canvas up. List
 * view keeps the plain static block (still height-capped + scrollable,
 * just always "expanded" since it's a normal page block, not chrome
 * sitting over content).
 */
export function ValidationPanel({ floating = false }: { floating?: boolean }) {
  const { issues, requestFlash } = useFlowEditor();
  const t = useTranslations("Flows.validation");
  const [expanded, setExpanded] = useState(!floating);

  if (issues.length === 0) {
    // Slate-950 base + emerald accents so the panel stays readable when
    // sticky-positioned over scrolled-behind node cards (a translucent
    // bg-emerald-500/10 would bleed through ugly).
    return (
      <div
        className={cn(
          "flex items-center gap-2 border border-emerald-600/50 text-sm font-medium text-emerald-300",
          floating
            ? "rounded-full bg-card px-3 py-1.5 text-xs shadow-card"
            : "rounded-lg bg-background p-3",
        )}
      >
        <CircleCheck className="h-4 w-4 shrink-0" />
        {t("noIssues")}
      </div>
    );
  }
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (floating && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={t("expand")}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-card transition-colors hover:bg-muted",
          errors.length > 0 ? "border-red-500/40" : "border-amber-500/40",
        )}
      >
        {errors.length > 0 ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
        ) : (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        )}
        <span style={{ color: CANVAS_MUTED_TEXT }}>
          {t("summary", { errorCount: errors.length, warningCount: warnings.length })}
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        floating ? "w-72 bg-card shadow-card" : "bg-background",
        errors.length > 0 ? "border-red-500/40" : "border-amber-500/40",
      )}
    >
      <button
        type="button"
        onClick={floating ? () => setExpanded(false) : undefined}
        aria-label={floating ? t("collapse") : undefined}
        className={cn(
          "mb-2 flex w-full items-center gap-2 text-xs",
          floating && "cursor-pointer",
        )}
        style={{ color: floating ? CANVAS_MUTED_TEXT : undefined }}
      >
        {errors.length > 0 ? (
          <CircleAlert className="h-4 w-4 shrink-0 text-red-400" />
        ) : (
          <CircleAlert className="h-4 w-4 shrink-0 text-amber-400" />
        )}
        <span className={cn("flex-1 text-left", !floating && "text-muted-foreground")}>
          {t("summary", { errorCount: errors.length, warningCount: warnings.length })}
        </span>
        {floating && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>
      <div
        className={cn(
          "flex flex-col gap-1 overflow-y-auto",
          floating ? "max-h-56" : "max-h-72",
        )}
      >
        {issues.map((i, ix) => (
          <IssueLine key={ix} issue={i} onJump={requestFlash} t={t} />
        ))}
      </div>
    </div>
  );
}

/**
 * Exported so the per-node card (list view) and the trigger panel
 * can render the same "icon + node key chip + message" formatting
 * for their own per-row issue lists without re-implementing the
 * tone / icon / accessibility logic.
 */
export function IssueLine({
  issue,
  onJump,
  t,
}: {
  issue: ValidationIssue;
  onJump?: (key: string) => void;
  t?: ReturnType<typeof useTranslations>;
}) {
  const tone =
    issue.severity === "error" ? "text-red-300" : "text-amber-300";
  const iconTone =
    issue.severity === "error" ? "text-red-400" : "text-amber-400";
  const body = (
    <>
      <CircleAlert className={cn("mt-0.5 h-3 w-3 shrink-0", iconTone)} />
      <span className="min-w-0 flex-1">
        {issue.node_key && (
          <code className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {issue.node_key}
          </code>
        )}
        {issue.message}
      </span>
    </>
  );

  // Only node-scoped issues can jump; trigger-scoped issues have no
  // destination (the trigger panel is list-only and already at the
  // top of that view).
  if (issue.node_key && onJump) {
    return (
      <button
        type="button"
        onClick={() => onJump(issue.node_key!)}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-muted/60",
          tone,
        )}
        aria-label={t ? t("jumpToNode", { key: issue.node_key! }) : `Jump to node ${issue.node_key}`}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1 text-xs",
        tone,
      )}
    >
      {body}
    </div>
  );
}
