"use client";

import { useMemo, useState } from "react";
import { addQuoteAction } from "@/app/(app)/actions";
import type { Article } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/app/voice-textarea";

type QuoteDraftFormProps = {
  projectId: string;
  suggestedVersion: number;
  articleOptions: Article[];
  /** Zapier aktiv: schlankes Formular; Texte/Konditionen werden in bexio am Entwurf ergänzt. */
  bexioDraftMode?: boolean;
  className?: string;
  onSuccess?: () => void | Promise<void>;
};

type DraftPosition = {
  key: string;
  source: "dienstleistung" | "artikel";
  refId: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

const SERVICE_CATALOG = [
  { id: "s1", label: "Abklärung / Fehlersuche", unit: "Std", unitPrice: 145 },
  { id: "s2", label: "Montage", unit: "Std", unitPrice: 135 },
  { id: "s3", label: "Reparatur", unit: "Std", unitPrice: 140 },
  { id: "s4", label: "Service / Wartung", unit: "Std", unitPrice: 130 },
  { id: "s5", label: "Fahrtpauschale", unit: "Pauschal", unitPrice: 65 },
];

function parseLocaleNumber(input: string): number {
  return Number(String(input).trim().replace(",", "."));
}

export function QuoteDraftForm({
  projectId,
  suggestedVersion,
  articleOptions,
  bexioDraftMode = false,
  className,
  onSuccess,
}: QuoteDraftFormProps) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [serviceQty, setServiceQty] = useState("1");
  const [articleQty, setArticleQty] = useState("1");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [vatPercent, setVatPercent] = useState("8.1");
  const [positions, setPositions] = useState<DraftPosition[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = positions.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
    const discount = Number(discountPercent || "0");
    const vat = Number(vatPercent || "0");
    const discountAmount = subtotal * (discount / 100);
    const totalNet = subtotal - discountAmount;
    const vatAmount = totalNet * (vat / 100);
    const totalGross = totalNet + vatAmount;
    return { subtotal, discountAmount, totalNet, vatAmount, totalGross };
  }, [positions, discountPercent, vatPercent]);

  return (
    <form
      className={className}
      action={async (fd) => {
        setError(null);
        fd.set("quoteItemsJson", JSON.stringify(positions));
        fd.set("discountPercent", discountPercent || "0");
        fd.set("vatPercent", vatPercent || "8.1");
        try {
          await addQuoteAction(fd);
          await onSuccess?.();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Offerte konnte nicht gespeichert werden.");
        }
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="version" value={String(suggestedVersion)} />

      {bexioDraftMode ? (
        <>
          <p className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs leading-relaxed text-sky-950">
            <span className="font-medium text-sky-900">bexio-Entwurf:</span> Hier erfassen Sie Kunde (Projekt) und
            Positionen. Briefanrede, Fließtexte und feine Konditionen ergänzen Sie nach dem Webhook in{" "}
            <span className="font-medium">bexio</span> am Angebot.
          </p>
          <input type="hidden" name="validityDays" value="30" />
          <input type="hidden" name="warrantyText" value="24 Monate" />
          <input type="hidden" name="leadTimeText" value="1 Woche" />
          <input type="hidden" name="downPaymentPercent" value="0" />
          <input type="hidden" name="paymentTermsText" value="30 Tage netto" />
          <input type="hidden" name="salutationText" value="" />
          <input type="hidden" name="textBlocks" value="" />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Gültigkeit (Tage)</Label>
            <select name="validityDays" className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none" defaultValue="30">
              <option value="14">14 Tage</option>
              <option value="30">30 Tage</option>
              <option value="60">60 Tage</option>
              <option value="90">90 Tage</option>
            </select>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Garantie</Label>
              <select
                name="warrantyText"
                defaultValue="24 Monate"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="12 Monate">12 Monate</option>
                <option value="24 Monate">24 Monate</option>
                <option value="36 Monate">36 Monate</option>
                <option value="Keine Garantie">Keine Garantie</option>
                <option value="Nach Herstellerangaben">Nach Herstellerangaben</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Lieferfrist</Label>
              <select
                name="leadTimeText"
                defaultValue="1 Woche"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="Sofort / ab Lager">Sofort / ab Lager</option>
                <option value="1 Woche">1 Woche</option>
                <option value="2 Wochen">2 Wochen</option>
                <option value="3-4 Wochen">3-4 Wochen</option>
                <option value="6-8 Wochen">6-8 Wochen</option>
                <option value="Nach Absprache">Nach Absprache</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Akontozahlung (%)</Label>
              <Input name="downPaymentPercent" type="number" min={0} max={100} step="0.1" defaultValue={0} className="h-9" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Zahlungskonditionen</Label>
              <select
                name="paymentTermsText"
                defaultValue="30 Tage netto"
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="Sofort zahlbar">Sofort zahlbar</option>
                <option value="10 Tage netto">10 Tage netto</option>
                <option value="20 Tage netto">20 Tage netto</option>
                <option value="30 Tage netto">30 Tage netto</option>
                <option value="50% bei Auftrag, Rest bei Abschluss">50% bei Auftrag, Rest bei Abschluss</option>
                <option value="Nach Absprache">Nach Absprache</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-sm">Briefanrede</Label>
            <Input name="salutationText" placeholder="z. B. Sehr geehrte Frau Muster" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Textbausteine</Label>
            <VoiceTextarea name="textBlocks" placeholder="Zusatztexte, Hinweise, Ausnahmen …" />
          </div>
        </>
      )}

      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">Offertenpositionen: Dienstleistungen</p>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_96px_auto] md:items-center">
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="">Dienstleistung wählen …</option>
            {SERVICE_CATALOG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.unitPrice.toFixed(2)} CHF/{s.unit})
              </option>
            ))}
          </select>
          <Input
            value={serviceQty}
            onChange={(e) => setServiceQty(e.target.value)}
            type="number"
            min={0.1}
            step="0.1"
            className="h-9 w-full"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              const s = SERVICE_CATALOG.find((x) => x.id === selectedServiceId);
              const qty = parseLocaleNumber(serviceQty);
              if (!s || !Number.isFinite(qty) || qty <= 0) {
                window.alert("Bitte zuerst eine Dienstleistung wählen und eine gültige Menge eingeben.");
                return;
              }
              setPositions((prev) => [
                ...prev,
                {
                  key: `svc-${Date.now()}-${s.id}`,
                  source: "dienstleistung",
                  refId: s.id,
                  description: s.label,
                  quantity: qty,
                  unit: s.unit,
                  unitPrice: s.unitPrice,
                },
              ]);
              setSelectedServiceId("");
              setServiceQty("1");
            }}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">Offertenpositionen: Artikel</p>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_96px_auto] md:items-center">
          <select
            value={selectedArticleId}
            onChange={(e) => setSelectedArticleId(e.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="">Artikel wählen …</option>
            {articleOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({(a.salePrice ?? 0).toFixed(2)} CHF/{a.unit ?? "Stk"})
              </option>
            ))}
          </select>
          <Input
            value={articleQty}
            onChange={(e) => setArticleQty(e.target.value)}
            type="number"
            min={1}
            step="1"
            className="h-9 w-full"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              const a = articleOptions.find((x) => x.id === selectedArticleId);
              const qty = parseLocaleNumber(articleQty);
              if (!a || !Number.isFinite(qty) || qty <= 0) {
                window.alert("Bitte zuerst einen Artikel wählen und eine gültige Menge eingeben.");
                return;
              }
              setPositions((prev) => [
                ...prev,
                {
                  key: `art-${Date.now()}-${a.id}`,
                  source: "artikel",
                  refId: a.id,
                  description: a.name,
                  quantity: qty,
                  unit: a.unit ?? "Stk",
                  unitPrice: a.salePrice ?? 0,
                },
              ]);
              setSelectedArticleId("");
              setArticleQty("1");
            }}
          >
            Hinzufügen
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <p className="text-sm font-medium">Positionen</p>
        {positions.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">Noch keine Positionen hinzugefügt.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {positions.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs">
                <span>{p.description}</span>
                <span>
                  {p.quantity} {p.unit} × {p.unitPrice.toFixed(2)} = {(p.quantity * p.unitPrice).toFixed(2)} CHF
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setPositions((prev) => prev.filter((x) => x.key !== p.key))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-sm">Rabatt (%)</Label>
          <Input
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value.replace(",", "."))}
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-sm">MWST (%)</Label>
          <Input
            value={vatPercent}
            onChange={(e) => setVatPercent(e.target.value.replace(",", "."))}
            type="number"
            min={0}
            max={100}
            step="0.1"
            className="h-9"
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 text-sm">
        <p>Summe netto: {totals.subtotal.toFixed(2)} CHF</p>
        <p>Rabatt: -{totals.discountAmount.toFixed(2)} CHF</p>
        <p>Total netto: {totals.totalNet.toFixed(2)} CHF</p>
        <p>MWST: {totals.vatAmount.toFixed(2)} CHF</p>
        <p className="font-semibold">Gesamtbetrag: {totals.totalGross.toFixed(2)} CHF</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm">Offerte erfassen</Button>
    </form>
  );
}
