"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";
import type { DocumentTemplate } from "@/lib/domain/types";
import {
  useDeleteDocumentTemplate,
  useDocumentTemplates,
  useSetDefaultDocumentTemplate,
  useUploadDocumentTemplate,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsRow } from "@/components/app/settings-row";

/**
 * Dokumentvorlagen (Word .docx) — Admin-Verwaltung. Fokus vorerst auf Offerten:
 * hochgeladene Vorlage füllt Bauflip mit den Offert-/Projektdaten (docxtemplater).
 */
export function DocumentTemplatesManager() {
  const templatesQuery = useDocumentTemplates();
  const upload = useUploadDocumentTemplate();
  const setDefault = useSetDefaultDocumentTemplate();
  const remove = useDeleteDocumentTemplate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const offerTemplates = (templatesQuery.data ?? []).filter((t) => t.kind === "offerte");
  const defaultTemplate = offerTemplates.find((t) => t.isDefault);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Bitte eine .docx-Vorlage wählen.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "offerte");
    fd.set("name", name.trim() || file.name.replace(/\.docx$/i, ""));
    fd.set("makeDefault", offerTemplates.length === 0 ? "1" : "0");
    try {
      await upload.mutateAsync(fd);
      toast.success("Vorlage hochgeladen");
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const summary = templatesQuery.isLoading
    ? "Wird geladen …"
    : offerTemplates.length === 0
      ? "Keine Vorlage — Offerten nutzen das Standard-PDF."
      : `Offerte: ${defaultTemplate?.name ?? offerTemplates[0].name}${offerTemplates.length > 1 ? ` (+${offerTemplates.length - 1})` : ""}`;

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
        description="Eigene Word-Vorlage für Offerten hochladen — Bauflip füllt sie mit den Offert- und Projektdaten. Das Layout deiner .docx bleibt erhalten."
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Schliessen
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Offert-Vorlagen
            </p>
            {templatesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Wird geladen …</p>
            ) : offerTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Vorlage hochgeladen.</p>
            ) : (
              <ul className="space-y-1.5">
                {offerTemplates.map((t) => (
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

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-foreground">Neue Vorlage hochladen (.docx)</p>
            <div>
              <Label className="text-[11px]">Bezeichnung (optional)</Label>
              <Input value={name} placeholder="z. B. Offerte Standard" onChange={(e) => setName(e.target.value)} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm file:mr-2.5 file:h-full file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:text-xs file:font-medium"
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
