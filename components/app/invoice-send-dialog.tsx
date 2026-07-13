"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import type { Invoice } from "@/lib/domain/types";
import { useSendInvoice } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Fokussiertes Senden-Fenster: E-Mail + optionale Nachricht, versendet die Rechnung mit QR-PDF. */
export function InvoiceSendDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
  defaultRecipientEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  invoice: Invoice | null;
  defaultRecipientEmail?: string | null;
}) {
  const sendInvoice = useSendInvoice();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");

  const openKey = open && invoice ? invoice.id : null;
  const [initedKey, setInitedKey] = useState<string | null>(null);
  if (openKey !== initedKey) {
    setInitedKey(openKey);
    if (openKey !== null && invoice) {
      setRecipientEmail(invoice.sentToEmail ?? defaultRecipientEmail ?? "");
      setMessage("");
    }
  }

  const submit = async () => {
    if (!invoice) return;
    try {
      await sendInvoice.mutateAsync({
        invoiceId: invoice.id,
        projectId,
        recipientEmail: recipientEmail.trim(),
        message: message.trim() || null,
      });
      toast.success("Rechnung versendet");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen.");
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={sendInvoice.isPending} onClick={() => onOpenChange(false)}>
        Abbrechen
      </Button>
      <Button type="button" disabled={sendInvoice.isPending || !recipientEmail.trim()} onClick={submit}>
        {sendInvoice.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        Mit PDF senden
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={invoice?.invoiceNumber ? `${invoice.invoiceNumber} senden` : "Rechnung senden"}
      description="Die Rechnung wird als QR-PDF an die angegebene Adresse gesendet."
      footer={footer}
    >
      <div className="space-y-3">
        <div>
          <Label className="text-[11px]">Senden an</Label>
          <Input
            type="email"
            value={recipientEmail}
            placeholder="kunde@example.com"
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[11px]">Persönliche Nachricht (optional)</Label>
          <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}
