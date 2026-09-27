"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Deal } from "@/types";

/**
 * The contact's most recently updated *open* deal, if any. Backs the
 * pipeline-stage badge in the thread header — deliberately its own small
 * fetch rather than reusing `ContactSidebar`'s (which loads every deal,
 * won/lost included, for the full panel's history view). Resolves to
 * `null` while loading, with no contact, or when the contact has no open
 * deal — callers render nothing in all three cases.
 */
export function useOpenDeal(contactId: string | null | undefined) {
  const [deal, setDeal] = useState<Deal | null>(null);

  const fetchOpenDeal = useCallback(async () => {
    if (!contactId) {
      setDeal(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("deals")
      .select("*, stage:pipeline_stages(*)")
      .eq("contact_id", contactId)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDeal((data as Deal | null) ?? null);
  }, [contactId]);

  // setDeal above only ever runs after the `await` (or synchronously in
  // the no-contact branch, matching ContactSidebar's fetchContactData —
  // see its own identical suppression).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOpenDeal();
  }, [fetchOpenDeal]);

  return deal;
}
