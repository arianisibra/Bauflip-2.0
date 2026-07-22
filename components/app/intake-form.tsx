"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useContacts, useCreateIntake, useExtractIntakePdf, useUploadAttachment } from "@/lib/query/hooks";
import type { Contact } from "@/lib/domain/types";
import type { IntakePdfExtraction } from "@/lib/validations/forms";
import { ContactPicker } from "@/components/app/contact-picker";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function IntakeForm({ onCreated }: { onCreated?: (projectId: string) => void }) {
  const createIntake = useCreateIntake();
  const extractPdf = useExtractIntakePdf();
  const uploadAttachment = useUploadAttachment();
  const contactsQuery = useContacts();
  const formRef = useRef<HTMLFormElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Gewählte Kontakt-ID je Rolle — geht als Hidden-Input mit und verknüpft Projekt ↔ Kontakt.
  const [linkedTenantId, setLinkedTenantId] = useState("");
  const [linkedManagementId, setLinkedManagementId] = useState("");
  // PDF bleibt bis zum Anlegen des Projekts im Speicher — wird danach als Anhang hochgeladen.
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const pending = createIntake.isPending;

  const setField = (name: string, value: string | null) => {
    const el = formRef.current?.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el && value) el.value = value;
  };

  // Vorbefüllung aus einer per KI gelesenen Auftrags-PDF — überschreibt nichts blind,
  // das Büro sieht und korrigiert die Felder wie gewohnt vor dem Anlegen.
  const applyExtractedFields = (fields: IntakePdfExtraction) => {
    setField("tenantName", fields.tenantName ?? null);
    setField("tenantPhone", fields.tenantPhone ?? null);
    setField("tenantEmail", fields.tenantEmail ?? null);
    setField("managementName", fields.managementName ?? null);
    setField("managementEmail", fields.managementEmail ?? null);
    setField("costCeilingText", fields.costCeilingText ?? null);
    setField("serviceStreet", fields.serviceStreet ?? null);
    setField("servicePostalCode", fields.servicePostalCode ?? null);
    setField("serviceCity", fields.serviceCity ?? null);
    setField("intakeOriginalText", fields.hintsAndNotes ?? null);
  };

  const handlePdfFile = async (file: File) => {
    setPdfError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("Bitte eine PDF-Datei wählen.");
      return;
    }
    setPdfFile(file);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const result = await extractPdf.mutateAsync(fd);
      if (result.success) {
        applyExtractedFields(result.fields);
      } else {
        setPdfError(result.error);
      }
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "PDF-Import fehlgeschlagen.");
    }
  };

  // Übernimmt einen Kontakt in die passenden Projektfelder: Verwaltung → Verwaltungsblock,
  // sonst → Mieter-/Kontaktblock. Adresse wird immer übernommen, wenn vorhanden.
  const applyContact = (c: Contact) => {
    if (c.kind === "verwaltung") {
      setField("managementName", c.companyName || c.displayName);
      setField("managementEmail", c.email);
      setLinkedManagementId(c.id);
    } else {
      setField("tenantName", c.displayName);
      setField("tenantPhone", c.phone || c.mobile);
      setField("tenantEmail", c.email);
      setLinkedTenantId(c.id);
    }
    setField("serviceStreet", c.street);
    setField("servicePostalCode", c.postalCode);
    setField("serviceCity", c.city);
  };

  const contacts = contactsQuery.data ?? [];

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      aria-busy={pending}
      action={async (fd) => {
        setError(null);
        try {
          const res = await createIntake.mutateAsync(fd);
          if (res?.projectId) {
            if (pdfFile) {
              const attachFd = new FormData();
              attachFd.set("projectId", res.projectId);
              attachFd.set("file", pdfFile);
              // Best-effort: schlägt der Anhang-Upload fehl, ist das Projekt trotzdem angelegt.
              uploadAttachment.mutate({ formData: attachFd, projectId: res.projectId });
            }
            onCreated?.(res.projectId);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
        }
      }}
    >
      <input type="hidden" name="source" value="email" />
      <input type="hidden" name="type" value="reparatur" />
      <input type="hidden" name="tenantContactId" value={linkedTenantId} />
      <input type="hidden" name="managementContactId" value={linkedManagementId} />

      <div className="space-y-1.5">
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePdfFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handlePdfFile(file);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border/70 bg-muted/20 hover:border-border hover:bg-muted/30",
          )}
        >
          {extractPdf.isPending ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : pdfFile ? (
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          ) : (
            <UploadCloud className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            {extractPdf.isPending ? (
              <span className="text-muted-foreground">PDF wird gelesen …</span>
            ) : pdfFile ? (
              <span className="truncate font-medium text-foreground">{pdfFile.name}</span>
            ) : (
              <>
                <span className="font-medium text-foreground">Auftrags-PDF hierher ziehen</span>{" "}
                <span className="text-muted-foreground">oder klicken — Felder werden automatisch ausgefüllt</span>
              </>
            )}
          </span>
          {pdfFile && !extractPdf.isPending ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setPdfFile(null);
                setPdfError(null);
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="PDF entfernen"
            >
              <X className="size-4" aria-hidden />
            </span>
          ) : null}
        </button>
        {pdfError ? <p className="text-xs text-destructive">{pdfError}</p> : null}
      </div>

      {contacts.length > 0 ? (
        <div className="space-y-1">
          <Label>Aus Kontakt übernehmen (optional)</Label>
          <ContactPicker contacts={contacts} onPick={applyContact} />
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="tenantName">Mieter / Kontakt</Label>
        <Input id="tenantName" name="tenantName" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="tenantPhone">Telefon Mieter</Label>
          <Input id="tenantPhone" name="tenantPhone" type="tel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tenantEmail">E-Mail Mieter</Label>
          <Input id="tenantEmail" name="tenantEmail" type="email" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="managementName">Verwaltung</Label>
        <Input id="managementName" name="managementName" placeholder="Name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="managementEmail">Zuständige Person</Label>
        <Input id="managementEmail" name="managementEmail" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="costCeilingText">Kostendach</Label>
        <Input id="costCeilingText" name="costCeilingText" placeholder="z. B. CHF 500 oder frei" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="serviceStreet">Strasse</Label>
          <Input id="serviceStreet" name="serviceStreet" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="servicePostalCode">PLZ</Label>
          <Input id="servicePostalCode" name="servicePostalCode" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor="serviceCity">Ort</Label>
          <Input id="serviceCity" name="serviceCity" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="intakeOriginalText">Wichtige Informationen</Label>
        <Textarea id="intakeOriginalText" name="intakeOriginalText" rows={5} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <BauflipLoadingButtonLabel variant="onPrimary">Wird angelegt …</BauflipLoadingButtonLabel>
        ) : (
          "Auftrag anlegen"
        )}
      </Button>
    </form>
  );
}
