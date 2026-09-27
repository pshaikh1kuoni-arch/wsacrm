"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import type { Conversation, MessageTemplate } from "@/types";
import { parseInternationalPhone } from "@/lib/whatsapp/phone-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplatePicker, type TemplateSendValues } from "./template-picker";

interface QuickSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once the template has actually been sent — the conversation
   *  the caller should select (contact embedded, same shape the Inbox
   *  list already fetches its rows in). */
  onSent: (conversation: Conversation) => void;
}

/**
 * "+ New message" — send a template to a phone number that may not be
 * a saved contact yet. Two steps: a phone-number dialog of our own,
 * then the existing `TemplatePicker` unchanged (it has no dependency
 * on a contact/conversation already existing). The actual find-or-
 * create-contact + send happens server-side in `/api/whatsapp/send`'s
 * `phone` path — this component only validates the phone shape enough
 * for immediate feedback; the server re-validates and is the source of
 * truth.
 */
export function QuickSendDialog({
  open,
  onOpenChange,
  onSent,
}: QuickSendDialogProps) {
  const t = useTranslations("Inbox.quickSend");

  const [step, setStep] = useState<"phone" | "template">("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Reset on every close path (rather than an effect keyed on `open`)
  // so a previous run never leaks into the next one (stale phone
  // number, mid-flow step, etc.) — the reset just needs to have
  // happened by the time it's opened again, not react to the open
  // itself.
  function closeAndReset() {
    setStep("phone");
    setPhone("");
    setPhoneError(null);
    onOpenChange(false);
  }

  function handleContinue() {
    if (!parseInternationalPhone(phone)) {
      setPhoneError(t("phoneNeedsCountryCode"));
      return;
    }
    setPhoneError(null);
    setStep("template");
  }

  // Fires for both an actual cancel and the picker's own self-close
  // after a pick (it closes itself synchronously before/around
  // `onSelect` — see its own `confirm`/`pickTemplate`). Either way the
  // whole quick-send flow is done with this open; the send itself (if
  // any) is already in flight via `handleTemplateSelect` below.
  function handleTemplateOpenChange(next: boolean) {
    if (!next) closeAndReset();
  }

  async function handleTemplateSelect(
    template: MessageTemplate,
    values: TemplateSendValues,
  ) {
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message_type: "template",
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t("toastFailed", { reason }));
        return;
      }

      toast.success(t("toastSent", { name: template.name }));
      if (payload?.conversation) {
        onSent(payload.conversation as Conversation);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      toast.error(t("toastFailed", { reason }));
    }
  }

  return (
    <>
      <Dialog
        open={open && step === "phone"}
        onOpenChange={(next) => {
          if (!next) closeAndReset();
        }}
      >
        <DialogContent className="border-border bg-popover sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("subtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="qs-phone" className="text-muted-foreground">
              {t("phoneLabel")}
            </Label>
            <Input
              id="qs-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleContinue();
              }}
              placeholder={t("phonePlaceholder")}
              className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
            {phoneError && (
              <p className="text-xs text-red-400">{phoneError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeAndReset}
              className="border-border text-popover-foreground hover:bg-muted"
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleContinue} disabled={!phone.trim()}>
              {t("continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplatePicker
        open={open && step === "template"}
        onOpenChange={handleTemplateOpenChange}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
