"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { OrganizationBillingSettings } from "@/lib/domain/types";
import { isQrIban, isValidQrBillIban } from "@/lib/qr-bill/iban";
import { billingSettingsSchema } from "@/lib/validations/forms";
import { useBillingSettings, useUpdateBillingSettings } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsRow } from "@/components/app/settings-row";

type FormState = {
  iban: string;
  creditorName: string;
  creditorStreet: string;
  creditorBuildingNumber: string;
  creditorPostalCode: string;
  creditorCity: string;
  vatNumber: string;
  phone: string;
  email: string;
  website: string;
};

const EMPTY_FORM: FormState = {
  iban: "",
  creditorName: "",
  creditorStreet: "",
  creditorBuildingNumber: "",
  creditorPostalCode: "",
  creditorCity: "",
  vatNumber: "",
  phone: "",
  email: "",
  website: "",
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
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    website: settings.website ?? "",
  };
}

/** Zahlungsdaten für QR-Rechnungen (Einstellungen, nur Admin): Zeile + Bearbeiten-Fenster. */
export function BillingSettingsForm() {
  const settingsQuery = useBillingSettings();
  const updateSettings = useUpdateBillingSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Beim Öffnen mit den aktuellen Werten befüllen (Render-Zeit-Init, kein useEffect).
  const [initedOpen, setInitedOpen] = useState(false);
  if (open && !initedOpen) {
    setInitedOpen(true);
    setForm(settingsQuery.data ? formFromSettings(settingsQuery.data) : EMPTY_FORM);
  } else if (!open && initedOpen) {
    setInitedOpen(false);
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const ibanTrimmed = form.iban.trim();
  const ibanValid = ibanTrimmed ? isValidQrBillIban(ibanTrimmed) : null;
  const ibanIsQr = ibanValid ? isQrIban(ibanTrimmed) : false;

  const submit = async () => {
    const payload = {
      iban: form.iban || null,
      creditorName: form.creditorName || null,
      creditorStreet: form.creditorStreet || null,
      creditorBuildingNumber: form.creditorBuildingNumber || null,
      creditorPostalCode: form.creditorPostalCode || null,
      creditorCity: form.creditorCity || null,
      vatNumber: form.vatNumber || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
    };
    const parsed = billingSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      await updateSettings.mutateAsync(payload);
      toast.success("Zahlungsdaten gespeichert");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const data = settingsQuery.data;
  const summary = settingsQuery.isLoading
    ? "Wird geladen …"
    : data?.iban
      ? `IBAN ${data.iban}${data.creditorCity ? ` · ${data.creditorCity}` : ""}`
      : "Noch nicht erfasst — ohne IBAN ist der Rechnungsversand deaktiviert.";

  const footer = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={updateSettings.isPending} onClick={() => setOpen(false)}>
        Abbrechen
      </Button>
      <Button type="button" disabled={updateSettings.isPending} onClick={submit}>
        {updateSettings.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Speichern
      </Button>
    </div>
  );

  return (
    <>
      <SettingsRow
        title="Zahlungsdaten (QR-Rechnung)"
        summary={summary}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={settingsQuery.isLoading}
            onClick={() => setOpen(true)}
          >
            Bearbeiten
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Zahlungsdaten (QR-Rechnung)"
        description="IBAN und Gläubiger-Adresse für den Zahlteil der QR-Rechnung."
        footer={footer}
      >
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
              <Input value={form.creditorName} placeholder="Muster AG" onChange={set("creditorName")} />
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">Telefon (optional)</Label>
              <Input value={form.phone} placeholder="044 123 45 67" onChange={set("phone")} />
            </div>
            <div>
              <Label className="text-[11px]">E-Mail (optional)</Label>
              <Input value={form.email} placeholder="info@firma.ch" onChange={set("email")} />
            </div>
          </div>
          <div>
            <Label className="text-[11px]">Website (optional)</Label>
            <Input value={form.website} placeholder="firma.ch" onChange={set("website")} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Diese Angaben erscheinen im Briefkopf von Offerten und Rechnungen.
          </p>
        </div>
      </Dialog>
    </>
  );
}
