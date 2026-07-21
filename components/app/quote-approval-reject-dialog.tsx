"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import type { Quote } from "@/lib/domain/types";
import { useRejectQuoteApproval } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Admin weist eine zur Freigabe eingereichte Offerte zurück — Büro sieht den Kommentar im Sheet. */
export function QuoteApprovalRejectDialog({
  open,
  onOpenChange,
  projectId,
  quote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  quote: Quote | null;
}) {
  const rejectApproval = useRejectQuoteApproval();
  const [note, setNote] = useState("");

  // Render-Zeit-Initialisierung (kein useEffect): beim Öffnen Feld leeren.
  const openKey = open && quote ? quote.id : null;
  const [initedKey, setInitedKey] = useState<string | null>(null);
  if (openKey !== initedKey) {
    setInitedKey(openKey);
    if (openKey !== null) setNote("");
  }

  const submit = async () => {
    if (!quote) return;
    try {
      await rejectApproval.mutateAsync({ quoteId: quote.id, projectId, note: note.trim() || null });
      toast.success("Offerte zurückgewiesen — zurück beim Büro");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zurückweisen fehlgeschlagen.");
    }
  };

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={rejectApproval.isPending} onClick={() => onOpenChange(false)}>
        Abbrechen
      </Button>
      <Button type="button" variant="destructive" disabled={rejectApproval.isPending} onClick={submit}>
        {rejectApproval.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <XCircle className="size-4" aria-hidden />
        )}
        Zurückweisen
      </Button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={quote?.quoteNumber ? `${quote.quoteNumber} zurückweisen` : "Offerte zurückweisen"}
      description="Die Offerte geht zurück in den Entwurf. Ein Kommentar hilft dem Büro, sie gezielt zu überarbeiten."
      footer={footer}
    >
      <div>
        <Label className="text-[11px]">Kommentar für das Büro (optional)</Label>
        <Textarea
          rows={3}
          value={note}
          placeholder="z. B. Preis für Position 2 prüfen"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
