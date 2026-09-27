"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

interface DashboardFullscreenContextValue {
  fullscreen: boolean;
  setFullscreen: Dispatch<SetStateAction<boolean>>;
}

const DashboardFullscreenContext = createContext<DashboardFullscreenContextValue>({
  fullscreen: false,
  setFullscreen: () => {},
});

export function DashboardFullscreenProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);
  return (
    <DashboardFullscreenContext.Provider value={{ fullscreen, setFullscreen }}>
      {children}
    </DashboardFullscreenContext.Provider>
  );
}

/**
 * Bridges a page's own full-screen toggle (currently Inbox's thread
 * header and the Flow editor's toolbar) to `Sidebar`, an ancestor via
 * `dashboard-shell.tsx` rather than a descendant of either page — plain
 * props can't reach it, hence the context (same shape as `AuthProvider`,
 * already used for the same kind of shell-wide state). Defaults to
 * `false` with no provider mounted, so nothing outside a driver page /
 * Sidebar needs to know this exists. Shell-wide by construction (the
 * provider wraps every dashboard route), so any page can drive it —
 * each driver just needs to reset it on unmount (see below) so leaving
 * that page never strands another with a collapsed sidebar.
 *
 * Deliberately not persisted to localStorage (unlike the inbox contact
 * panel's open/closed state): full-screen is a per-session reading mode
 * you re-enter deliberately, not a lasting layout preference. Each
 * driver page resets it on unmount so navigating away never strands
 * another page with a collapsed sidebar and no visible way to expand it
 * again.
 */
export function useDashboardFullscreen() {
  return useContext(DashboardFullscreenContext);
}
