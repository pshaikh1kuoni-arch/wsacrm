"use client";

/**
 * View-switcher + chrome for the flow editor.
 *
 * Lays the editor out as one app-like column that fills the dashboard
 * content area (toolbar → mode row → stage → validation), matching
 * the Flow Builder design handoff:
 *   - A node-type legend button (popover) on the left of the mode row,
 *     so the canvas's per-type colors are decodable at a glance without
 *     spending permanent vertical space on a full row of labels.
 *   - A segmented Canvas / List control next to it.
 *   - The active view is mounted inside a rounded "stage" that owns its
 *     own scroll/overflow, so the canvas can fill available height and
 *     the list scrolls internally. In canvas view, validation floats
 *     over the stage instead of taking its own row below it.
 *
 * Why a separate component:
 *   - The page itself stays trivially small (loading + error + this).
 *   - Either view can stay unaware of the other — they share data
 *     (`{flow, nodes}`) and nothing else.
 *
 * View choice persists per-browser via localStorage so a power user
 * who prefers the list isn't fighting the default on every load.
 * Canvas is the default for everyone else — the original user
 * feedback was that the list shape made flows "hard to understand".
 */

import { useCallback, useEffect, useState } from "react";
import { GitFork, List } from "lucide-react";

import { FlowBuilder } from "./flow-builder";
import { FlowCanvas } from "./flow-canvas";
import { FlowEditorProvider } from "./flow-editor-state";
import { EditorHeader } from "./header";
import { NodeTypeLegend } from "./node-type-legend";
import { ValidationPanel } from "./validation-panel";
import { cn } from "@/lib/utils";
import type { FlowRow, FlowNodeRow } from "@/lib/flows/types";
import { useTranslations } from "next-intl";
import { useDashboardFullscreen } from "@/hooks/use-dashboard-fullscreen";

/**
 * Below this viewport width we force list view and hide the toggle.
 * Canvas with drag-to-connect on a phone is unusable — handles are
 * ~10px and live finger drags from one node to another aren't a
 * practical workflow. Matches Tailwind's `md` breakpoint.
 */
const MOBILE_BREAKPOINT = "(max-width: 767px)";

type View = "canvas" | "list";

const STORAGE_KEY = "wacrm.flowEditor.view";

interface Props {
  initialFlow: FlowRow;
  initialNodes: FlowNodeRow[];
}

export function FlowEditorShell({ initialFlow, initialNodes }: Props) {
  const t = useTranslations("Flows.builder");

  // Read the persisted choice in the useState initializer. Safe even
  // though this is a client component because the parent page only
  // mounts us AFTER a client-side fetch resolves — there's no SSR
  // pass for this subtree, so no hydration mismatch to worry about.
  // Default to `canvas` (the new default) when nothing is saved.
  const [view, setView] = useState<View>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "canvas" || saved === "list") return saved;
    } catch {
      // Private browsing / disabled storage — fall through to default.
    }
    return "canvas";
  });

  // Live mobile detection. We don't render canvas under the
  // breakpoint regardless of `view` — but we keep `view` itself
  // intact so the user's preference comes back when they widen
  // again (e.g. rotating a tablet, resizing a window).
  const isMobile = useMatchMedia(MOBILE_BREAKPOINT);
  const effectiveView: View = isMobile ? "list" : view;

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  // Full-screen mode: collapses the dashboard's own left nav to an
  // icon-only rail (see `useDashboardFullscreen`) so the canvas can use
  // the width it gives back — same mechanism Inbox drives from its own
  // thread header. Deliberately not persisted and reset on unmount, for
  // the same reason Inbox's driver resets: leaving `/flows/[id]` should
  // never strand another page with a collapsed sidebar.
  const { fullscreen, setFullscreen } = useDashboardFullscreen();
  const handleToggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, [setFullscreen]);
  useEffect(() => {
    return () => setFullscreen(false);
  }, [setFullscreen]);

  return (
    <FlowEditorProvider initialFlow={initialFlow} initialNodes={initialNodes}>
      <div className="flex h-full min-h-0 flex-col">
        {/* ---- header card: toolbar + mode row share one floating
            panel, matching the stage below instead of sitting bare
            on the page background. `pb-5` only kicks in on mobile,
            where the mode row (which otherwise supplies its own
            bottom padding via `py-3.5`) is omitted entirely. */}
        <div
          className={cn(
            "mx-6 rounded-2xl bg-card shadow-card",
            isMobile && "pb-5",
          )}
        >
          <EditorHeader
            fullscreen={fullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />

          {/* ---- mode row: node-type legend + view toggle ----
              Omitted entirely on mobile (canvas is unavailable there),
              so there's no empty band above the stage on small screens. */}
          {!isMobile && (
            <div className="flex items-center gap-3 px-6 py-3.5">
              <NodeTypeLegend />
              <div
                role="group"
                aria-label={t("editorView")}
                className="inline-flex gap-0.5 rounded-lg border border-border bg-muted p-0.5"
              >
                <SegButton
                  active={effectiveView === "canvas"}
                  onClick={() => choose("canvas")}
                  icon={<GitFork className="h-3.5 w-3.5" />}
                  label={t("canvasView")}
                />
                <SegButton
                  active={effectiveView === "list"}
                  onClick={() => choose("list")}
                  icon={<List className="h-3.5 w-3.5" />}
                  label={t("listView")}
                />
              </div>
            </div>
          )}
        </div>

        {/* ---- stage: the active view, owning its own overflow ----
            Canvas view floats the validation panel over the stage
            (bottom-left, offset clear of react-flow's own zoom
            Controls at its default bottom-left position) so a long
            flow's warnings never grow the layout or push the canvas
            up. List view keeps the panel as a plain block below.
            `mt-4` is the real gap between this card and the header
            card above it — no shared border, matching the app's
            floating-panel pattern. */}
        <div className="relative mx-6 mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl bg-card-2 shadow-card">
          {effectiveView === "canvas" ? (
            <FlowCanvas />
          ) : (
            <div className="absolute inset-0 overflow-y-auto">
              <FlowBuilder />
            </div>
          )}
          {effectiveView === "canvas" && (
            <div className="absolute bottom-[15px] left-[58px] z-10 max-w-[calc(100%-90px)]">
              <ValidationPanel floating />
            </div>
          )}
        </div>

        {effectiveView === "list" && (
          <div className="px-6 pb-5 pt-3">
            <ValidationPanel />
          </div>
        )}
      </div>
    </FlowEditorProvider>
  );
}

/**
 * Tiny `useMatchMedia` shim. We could pull in `react-responsive` but
 * this is the only consumer and matchMedia is one of those browser
 * APIs that doesn't need a dependency.
 */
function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Safari < 14 still uses addListener; addEventListener is the
    // modern path. Both fire identically.
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function SegButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
