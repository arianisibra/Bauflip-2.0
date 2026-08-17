"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";
import type { DocumentTemplate, DocumentTemplateKind } from "@/lib/domain/types";
import {
  useDeleteDocumentTemplate,
  useDocumentTemplates,
  useSetDefaultDocumentTemplate,
  useUploadDocumentTemplate,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsRow } from "@/components/app/settings-row";

/** Vorlagen-Arten mit Laufzeit-Unterstützung. */
const SUPPORTED_KINDS: { kind: DocumentTemplateKind; label: string; hint: string }[] = [
  { kind: "offerte", label: "Offerte", hint: "z. B. {offerte_nummer}, {kunde_name}, {#positionen}…{/positionen}" },
  { kind: "auftrag", label: "Auftrag", hint: "z. B. {auftrag_nummer}, {kunde_name}, {beschreibung}, {objekt}" },
  { kind: "rapport", label: "Rapport", hint: "z. B. {monteur}, {ergebnis}, {arbeitsbeschreibung}, {zeit}" },
  { kind: "rechnung", label: "Rechnung", hint: "z. B. {rechnung_nummer}, {kunde_name}, {#positionen}…{/positionen}" },
];

/**
 * Dokumentvorlagen (Word .docx) — Admin-Verwaltung. Eigene Vorlagen für Offerte und
 * Auftrag: Bauflip füllt sie mit den Projekt-/Offertdaten (docxtemplater).
 */
export function DocumentTemplatesManager() {
  const templatesQuery = useDocumentTemplates();
  const upload = useUploadDocumentTemplate();
  const setDefault = useSetDefaultDocumentTemplate();
  const remove = useDeleteDocumentTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [uploadKind, setUploadKind] = useState<DocumentTemplateKind>("offerte");

  const templates = templatesQuery.data ?? [];
  const byKind = (kind: DocumentTemplateKind) => templates.filter((t) => t.kind === kind);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Bitte eine .docx-Vorlage wählen.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", uploadKind);
    fd.set("name", name.trim() || file.name.replace(/\.docx$/i, ""));
    fd.set("makeDefault", byKind(uploadKind).length === 0 ? "1" : "0");
    try {
      await upload.mutateAsync(fd);
      toast.success("Vorlage hochgeladen");
      setName("");
      setFileInputKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hochladen fehlgeschlagen.");
    }
  };

  const handleSetDefault = async (t: DocumentTemplate) => {
    try {
      await setDefault.mutateAsync({ id: t.id, kind: t.kind });
      toast.success(`«${t.name}» ist jetzt Standard`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehlgeschlagen.");
    }
  };

  const handleDelete = async (t: DocumentTemplate) => {
    if (!window.confirm(`Vorlage «${t.name}» löschen?`)) return;
    try {
      await remove.mutateAsync(t.id);
      toast.success("Vorlage gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  const summaryParts = SUPPORTED_KINDS.map(({ kind, label }) => {
    const list = byKind(kind);
    if (list.length === 0) return null;
    const def = list.find((t) => t.isDefault) ?? list[0];
    return `${label}: ${def.name}${list.length > 1 ? ` (+${list.length - 1})` : ""}`;
  }).filter(Boolean);
  const summary = templatesQuery.isLoading
    ? "Wird geladen …"
    : summaryParts.length === 0
      ? "Keine Vorlage — Offerten/Aufträge nutzen das Standard-PDF bzw. keine Word-Ausgabe."
      : summaryParts.join(" · ");

  return (
    <>
      <SettingsRow
        title="Dokumentvorlagen (Word)"
        summary={summary}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Verwalten
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Dokumentvorlagen"
        description="Eigene Word-Vorlage für Offerte und Auftrag hochladen — Bauflip füllt sie mit den Projekt- und Offertdaten. Das Layout deiner .docx bleibt erhalten."
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Schliessen
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {SUPPORTED_KINDS.map(({ kind, label }) => {
            const list = byKind(kind);
            return (
              <div key={kind}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}-Vorlagen
                </p>
                {templatesQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Wird geladen …</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Vorlage hochgeladen.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {list.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {t.isDefault ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          ) : null}
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {!t.isDefault ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={setDefault.isPending}
                              onClick={() => handleSetDefault(t)}
                            >
                              Als Standard
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            aria-label="Löschen"
                            disabled={remove.isPending}
                            onClick={() => handleDelete(t)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-foreground">Neue Vorlage hochladen (.docx)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Art</Label>
                <select
                  value={uploadKind}
                  onChange={(e) => setUploadKind(e.target.value as DocumentTemplateKind)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                >
                  {SUPPORTED_KINDS.map(({ kind, label }) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[11px]">Bezeichnung (optional)</Label>
                <Input value={name} placeholder="z. B. Standard" onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Platzhalter der gewählten Art: {SUPPORTED_KINDS.find((k) => k.kind === uploadKind)?.hint}
            </p>
            <FileInput
              key={fileInputKey}
              ref={fileInputRef}
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              buttonLabel="Datei wählen"
              placeholder="Keine .docx-Vorlage ausgewählt"
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={upload.isPending} onClick={handleUpload}>
                {upload.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                Hochladen
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
