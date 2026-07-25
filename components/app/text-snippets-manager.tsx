"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { TextSnippet } from "@/lib/domain/types";
import { textSnippetSchema } from "@/lib/validations/forms";
import {
  useCreateTextSnippet,
  useDeleteTextSnippet,
  useTextSnippets,
  useUpdateTextSnippet,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsRow } from "@/components/app/settings-row";

type SnippetFormState = {
  /** null = neuer Textbaustein. */
  id: string | null;
  title: string;
  body: string;
};

const EMPTY_FORM: SnippetFormState = { id: null, title: "", body: "" };

/** Textbausteine-Verwaltung (Einstellungen): Zeile + Verwalten-Fenster mit Liste + Add/Edit. */
export function TextSnippetsManager() {
  const snippetsQuery = useTextSnippets();
  const createSnippet = useCreateTextSnippet();
  const updateSnippet = useUpdateTextSnippet();
  const deleteSnippet = useDeleteTextSnippet();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SnippetFormState | null>(null);

  const snippets = snippetsQuery.data ?? [];
  const pending = createSnippet.isPending || updateSnippet.isPending;

  const submit = async () => {
    if (!form) return;
    const payload = { title: form.title, body: form.body };
    const parsed = textSnippetSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (form.id) {
        await updateSnippet.mutateAsync({ ...payload, id: form.id });
        toast.success("Textbaustein aktualisiert");
      } else {
        await createSnippet.mutateAsync(payload);
        toast.success("Textbaustein erstellt");
      }
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const summary = snippetsQuery.isLoading
    ? "Wird geladen …"
    : snippets.length === 0
      ? "Noch keine Textbausteine"
      : `${snippets.length} Textbaustein${snippets.length === 1 ? "" : "e"}`;

  return (
    <>
      <SettingsRow
        title="Textbausteine"
        summary={summary}
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Verwalten
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setForm(null);
        }}
        title="Textbausteine"
        description="Wiederverwendbare Texte für Einleitungs- und Schlusstext auf Offerten/Rechnungen."
        footer={
          <div className="flex items-center justify-between gap-2">
            {!form ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
                <Plus className="size-4" aria-hidden />
                Neuer Textbaustein
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Schliessen
            </Button>
          </div>
        }
      >
        {snippetsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Textbausteine werden geladen …</p>
        ) : null}
        {!snippetsQuery.isLoading && snippets.length === 0 && !form ? (
          <p className="text-sm text-muted-foreground">Noch keine Textbausteine erfasst.</p>
        ) : null}

        <ul className="divide-y divide-border">
          {snippets.map((snippet: TextSnippet) => (
            <li key={snippet.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{snippet.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">{snippet.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Bearbeiten"
                  onClick={() => setForm({ id: snippet.id, title: snippet.title, body: snippet.body })}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label="Löschen"
                  disabled={deleteSnippet.isPending}
                  onClick={async () => {
                    try {
                      await deleteSnippet.mutateAsync({ snippetId: snippet.id });
                      toast.success("Textbaustein gelöscht");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                    }
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {form ? (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-foreground">
              {form.id ? "Textbaustein bearbeiten" : "Neuer Textbaustein"}
            </p>
            <div>
              <Label className="text-[11px]">Titel</Label>
              <Input
                value={form.title}
                placeholder="z. B. Zahlungskonditionen"
                onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              />
            </div>
            <div>
              <Label className="text-[11px]">Text</Label>
              <Textarea
                rows={4}
                value={form.body}
                placeholder="Text, der beim Auswählen in Einleitungs- oder Schlusstext eingefügt wird."
                onChange={(e) => setForm((prev) => (prev ? { ...prev, body: e.target.value } : prev))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setForm(null)}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" disabled={pending} onClick={submit}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {form.id ? "Speichern" : "Erstellen"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
