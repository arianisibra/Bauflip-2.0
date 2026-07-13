"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import type { Quote } from "@/lib/domain/types";
import { useSendQuote } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Fokussiertes Senden-Fenster: E-Mail + optionale Nachricht, versendet die Offerte mit PDF. */
export function QuoteSendDialog({
  open,
  onOpenChange,
  projectId,
  quote,
  defaultRecipientEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  quote: Quote | null;
  defaultRecipientEmail?: string | null;
}) {
  const sendQuote = useSendQuote();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");

  // Render-Zeit-Initialisierung (kein useEffect): beim Öffnen Empfänger vorbefüllen.
  const openKey = open && quote ? quote.id : null;
  const [initedKey, setInitedKey] = useState<string | null>(null);
  if (openKey !== initedKey) {
    setInitedKey(openKey);
    if (openKey !== null && quote) {
      setRecipientEmail(quote.sentToEmail ?? defaultRecipientEmail ?? "");
      setMessage("");
    }
  }

  const submit = async () => {
    if (!quote) return;
    try {
      await sendQuote.mutateAsync({
        quoteId: quote.id,
        projectId,
        recipientEmail: recipientEmail.trim(),
        message: message.trim() || null,
      });
      toast.success("Offerte versendet");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versand fehlgeschlagen.");
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={sendQuote.isPending} onClick={() => onOpenChange(false)}>
        Abbrechen
      </Button>
      <Button
        type="button"
        disabled={sendQuote.isPending || !recipientEmail.trim()}
        onClick={submit}
      >
        {sendQuote.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        Mit PDF senden
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={quote?.quoteNumber ? `${quote.quoteNumber} senden` : "Offerte senden"}
      description="Die Offerte wird als PDF an die angegebene Adresse gesendet."
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
