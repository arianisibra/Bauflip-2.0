"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectCore } from "@/lib/db/repository";
import type { OrderFormTemplate } from "@/lib/domain/types";
import { formatServiceAddress, managementLabel, tenantLabel } from "@/lib/tech/bundle-display";
import { submitTechnicianReportAction } from "@/app/(tech)/actions";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { MonteurOrderFormSections } from "@/components/app/monteur-order-form-sections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  ImagePlus,
  KeyRound,
  MapPin,
  Navigation,
  Paperclip,
  User,
} from "lucide-react";

function buildMapsUrl(p: { serviceStreet: string | null; servicePostalCode: string | null; serviceCity: string | null }): string | null {
  const parts = [p.serviceStreet, p.servicePostalCode, p.serviceCity].filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(", "))}`;
}

function orderFormsPayloadFromFormData(fd: FormData, templates: OrderFormTemplate[]) {
  return templates.map((t) => {
    const values: Record<string, string> = {};
    for (const f of t.fields) {
      values[f.key] = String(fd.get(`orderForm__${t.id}__${f.key}`) ?? "");
    }
    return { templateId: t.id, values };
  });
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export function MonteurAuftragClient({
  core,
  orderFormTemplates = [],
}: {
  core: ProjectCore;
  orderFormTemplates?: OrderFormTemplate[];
}) {
  const router = useRouter();
  const p = core.project;
  const [mode, setMode] = useState<"schaden_behoben" | "schaden_aufgenommen" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextAppt = useMemo(
    () => [...core.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
    [core.appointments],
  );

  return (
    <section className="flex flex-col gap-4 pb-8">
      {/* --- Header Card --- */}
      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {p.referenceCode ? (
              <Badge variant="secondary" className="font-mono text-[11px]">
                {p.referenceCode}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[11px]">Auftrag</Badge>
          </div>
          <CardTitle className="mt-1 text-xl leading-tight">{p.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <InfoRow icon={MapPin} label="Adresse">
            {formatServiceAddress(p)}
          </InfoRow>
          {buildMapsUrl(p) ? (
            <a
              href={buildMapsUrl(p)!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors active:scale-[0.98] hover:bg-primary/10"
            >
              <Navigation className="size-4" />
              Route starten
            </a>
          ) : null}
          <InfoRow icon={Clock} label="Termin">
            {nextAppt
              ? `${new Date(nextAppt.startsAt).toLocaleString("de-CH")} – ${new Date(nextAppt.endsAt).toLocaleTimeString("de-CH")}`
              : "—"}
          </InfoRow>
          <InfoRow icon={User} label="Mieter">
            <span>{tenantLabel(p)}</span>
            {p.tenantPhone?.trim() ? (
              <a
                href={`tel:${p.tenantPhone.trim()}`}
                className="ml-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {p.tenantPhone.trim()}
              </a>
            ) : null}
          </InfoRow>
          <InfoRow icon={Building2} label="Verwaltung">
            {managementLabel(p)}
          </InfoRow>
          <InfoRow icon={Banknote} label="Kostendach">
            {p.costCeilingText?.trim() || "—"}
          </InfoRow>

          {p.accessNotes?.trim() ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Zugang / Schlüssel
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                  {p.accessNotes.trim()}
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Problem / Auftrag Card --- */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Problem / Auftrag</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {p.intakeOriginalText}
          </p>
          {p.hintsAndNotes ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Hinweis Büro
                </p>
                <p className="mt-0.5 text-sm text-foreground">{p.hintsAndNotes}</p>
              </div>
            </div>
          ) : null}
          {core.attachments.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Anhänge
              </p>
              <ul className="space-y-1">
                {core.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Paperclip className="size-3 shrink-0" />
                    {a.fileName}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Einsatz mode selection --- */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Einsatz
        </h2>
        <div className="grid gap-3 grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("schaden_behoben")}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-all active:scale-[0.97] ${
              mode === "schaden_behoben"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <CheckCircle2
              className={`size-7 ${
                mode === "schaden_behoben" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Behoben</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Reparatur abgeschlossen
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("schaden_aufgenommen")}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-all active:scale-[0.97] ${
              mode === "schaden_aufgenommen"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:bg-muted/30"
            }`}
          >
            <ClipboardList
              className={`size-7 ${
                mode === "schaden_aufgenommen" ? "text-primary" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="text-sm font-semibold text-foreground">Aufgenommen</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Masse / Offerte folgt
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* --- Report form --- */}
      {mode ? (
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-sm">Rapport erfassen</CardTitle>
                <CardDescription className="text-xs">
                  {mode === "schaden_behoben"
                    ? "Kurze Zusammenfassung der Reparatur."
                    : "Masse und Hinweise für die Offerte."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setPending(true);
                setError(null);
                try {
                  const result = await submitTechnicianReportAction({
                    projectId: p.id,
                    outcome: mode,
                    summary: String(fd.get("summary") ?? ""),
                    measurementsJson: String(fd.get("measurementsJson") ?? "{}"),
                    workDescription: String(fd.get("workDescription") ?? ""),
                    orderForms: orderFormsPayloadFromFormData(fd, orderFormTemplates),
                  });
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  router.push("/tag");
                  router.refresh();
                } catch {
                  setError("Speichern fehlgeschlagen.");
                } finally {
                  setPending(false);
                }
              }}
            >
              <input type="hidden" name="outcome" value={mode} />
              {mode === "schaden_behoben" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="summary" className="text-xs font-medium">
                      Kurze Notiz
                    </Label>
                    <Textarea id="summary" name="summary" rows={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="workDescription" className="text-xs font-medium">
                      Material / Hinweise
                    </Label>
                    <Textarea id="workDescription" name="workDescription" rows={2} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="measurementsJson" className="text-xs font-medium">
                      Masse und Notizen
                    </Label>
                    <Textarea
                      id="measurementsJson"
                      name="measurementsJson"
                      rows={4}
                      defaultValue="{}"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="workDescription" className="text-xs font-medium">
                      Hinweis für Bestellung / Offerte
                    </Label>
                    <Textarea id="workDescription" name="workDescription" rows={3} />
                  </div>
                </>
              )}

              <MonteurOrderFormSections templates={orderFormTemplates} />

              {/* Photo upload zone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fotos (optional)</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:bg-muted/40 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Camera className="size-5" />
                    <ImagePlus className="size-5" />
                  </div>
                  {uploadedFileName ? (
                    <p className="text-xs font-medium text-primary">{uploadedFileName}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Foto aufnehmen oder auswählen
                    </p>
                  )}
                </button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (ev) => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    setUploadedFileName(file.name);
                    const fd = new FormData();
                    fd.set("projectId", p.id);
                    fd.set("file", file);
                    setPending(true);
                    try {
                      const result = await uploadProjectReportFileAction(fd);
                      if (!result.success) {
                        setError(result.error);
                      } else {
                        router.refresh();
                      }
                    } catch {
                      setError("Upload fehlgeschlagen.");
                    } finally {
                      setPending(false);
                    }
                  }}
                />
              </div>

              {/* Error */}
              {error ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              ) : null}

              {/* Sticky submit */}
              <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md">
                <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
                  {pending ? (
                    <BauflipLoadingButtonLabel>Speichern…</BauflipLoadingButtonLabel>
                  ) : (
                    "Abschliessen"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
