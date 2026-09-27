"use client";

import { ChevronUp } from "lucide-react";
import type { Contact } from "@/types";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { useTranslations } from "next-intl";

interface ContactPanelBarProps {
  contact: Contact | null;
  onExpand: () => void;
}

/**
 * Collapsed form of `ContactSidebar` — a slim pull-tab bar the contact
 * panel tucks into instead of unmounting outright, so the thread can
 * reclaim its width without losing the sense that the panel is still
 * there. `onExpand` flips the page's `contactPanelOpen` state back on.
 */
export function ContactPanelBar({ contact, onExpand }: ContactPanelBarProps) {
  const t = useTranslations("Inbox.sidebar");

  if (!contact) return null;

  const displayName = contact.name || contactHandle(contact);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-15 shrink-0 items-center justify-between gap-3 rounded-2xl bg-card px-4 shadow-card">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {contactHandle(contact)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <ChevronUp className="h-3.5 w-3.5" />
        {t("pullOutContactPanel")}
      </button>
    </div>
  );
}
