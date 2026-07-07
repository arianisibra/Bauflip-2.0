"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { OrganizationBillingSettings } from "@/lib/domain/types";
import { isQrIban, isValidQrBillIban } from "@/lib/qr-bill/iban";
import { billingSettingsSchema } from "@/lib/validations/forms";
import { useBillingSettings, useUpdateBillingSettings } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState = {
  iban: string;
  creditorName: string;
  creditorStreet: string;
  creditorBuildingNumber: string;
  creditorPostalCode: string;
  creditorCity: string;
  vatNumber: string;
};

function formFromSettings(settings: OrganizationBillingSettings): FormState {
  return {
    iban: settings.iban ?? "",
    creditorName: settings.creditorName ?? "",
    creditorStreet: settings.creditorStreet ?? "",
    creditorBuildingNumber: settings.creditorBuildingNumber ?? "",
    creditorPostalCode: settings.creditorPostalCode ?? "",
    creditorCity: settings.creditorCity ?? "",
    vatNumber: settings.vatNumber ?? "",
  };
}

/** Zahlungsdaten für QR-Rechnungen (Einstellungen, nur Admin). */
export function BillingSettingsForm() {
  const settingsQuery = useBillingSettings();
  const updateSettings = useUpdateBillingSettings();
  const [form, setForm] = useState<FormState | null>(null);

  // Initialwert während des Renders nachziehen (Repo-Muster, kein useEffect):
  // sobald die Query liefert und noch kein lokaler Zustand existiert.
  if (settingsQuery.data && form === null) {
    setForm(formFromSettings(settingsQuery.data));
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const ibanTrimmed = form?.iban.trim() ?? "";
  const ibanValid = ibanTrimmed ? isValidQrBillIban(ibanTrimmed) : null;
  const ibanIsQr = ibanValid ? isQrIban(ibanTrimmed) : false;

  const submit = async () => {
    if (!form) return;
    const payload = {
      iban: form.iban || null,
      creditorName: form.creditorName || null,
      creditorStreet: form.creditorStreet || null,
      creditorBuildingNumber: form.creditorBuildingNumber || null,
      creditorPostalCode: form.creditorPostalCode || null,
      creditorCity: form.creditorCity || null,
      vatNumber: form.vatNumber || null,
    };
    const parsed = billingSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      const saved = await updateSettings.mutateAsync(payload);
      setForm(formFromSettings(saved));
      toast.success("Zahlungsdaten gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Zahlungsdaten (QR-Rechnung)</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          IBAN und Gläubiger-Adresse für den Zahlteil der QR-Rechnung. Ohne IBAN ist der
          Rechnungsversand deaktiviert.
        </p>
      </div>

      {settingsQuery.isLoading || !form ? (
        <p className="text-sm text-muted-foreground">Zahlungsdaten werden geladen …</p>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px]">IBAN oder QR-IBAN (CH/LI)</Label>
            <Input
              value={form.iban}
              placeholder="CH00 0000 0000 0000 0000 0"
              onChange={set("iban")}
              aria-invalid={ibanValid === false}
            />
            {ibanValid === false ? (
              <p className="mt-1 text-[11px] text-destructive">
                Ungültige IBAN — QR-Rechnungen erlauben nur CH-/LI-IBANs.
              </p>
            ) : null}
            {ibanValid === true ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {ibanIsQr
                  ? "QR-IBAN erkannt — Rechnungen erhalten eine QR-Referenz (QRR)."
                  : "Normale IBAN erkannt — Rechnungen erhalten eine Creditor Reference (SCOR)."}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label className="text-[11px]">Gläubigername (Firma)</Label>
              <Input value={form.creditorName} placeholder="Bauflip Storen AG" onChange={set("creditorName")} />
            </div>
            <div>
              <Label className="text-[11px]">UID / MwSt-Nr. (optional)</Label>
              <Input value={form.vatNumber} placeholder="CHE-123.456.789 MWST" onChange={set("vatNumber")} />
            </div>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <div>
              <Label className="text-[11px]">Strasse</Label>
              <Input value={form.creditorStreet} placeholder="Musterstrasse" onChange={set("creditorStreet")} />
            </div>
            <div>
              <Label className="text-[11px]">Nr.</Label>
              <Input value={form.creditorBuildingNumber} placeholder="12" onChange={set("creditorBuildingNumber")} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <div>
              <Label className="text-[11px]">PLZ</Label>
              <Input value={form.creditorPostalCode} placeholder="8004" onChange={set("creditorPostalCode")} />
            </div>
            <div>
              <Label className="text-[11px]">Ort</Label>
              <Input value={form.creditorCity} placeholder="Zürich" onChange={set("creditorCity")} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={updateSettings.isPending} onClick={submit}>
              {updateSettings.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Speichern
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
