"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, Loader2, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { contactKindLabels, contactKinds, type Contact, type ContactKind } from "@/lib/domain/types";
import { contactSchema } from "@/lib/validations/forms";
import {
  useContactProjects,
  useContacts,
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from "@/lib/query/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  id: string | null;
  kind: ContactKind;
  displayName: string;
  companyName: string;
  email: string;
  phone: string;
  mobile: string;
  street: string;
  postalCode: string;
  city: string;
  notes: string;
  kundenNummer: string;
};

const EMPTY: FormState = {
  id: null,
  kind: "privat",
  displayName: "",
  companyName: "",
  email: "",
  phone: "",
  mobile: "",
  street: "",
  postalCode: "",
  city: "",
  notes: "",
  kundenNummer: "",
};

function fromContact(c: Contact): FormState {
  return {
    id: c.id,
    kind: c.kind,
    displayName: c.displayName,
    companyName: c.companyName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    mobile: c.mobile ?? "",
    street: c.street ?? "",
    postalCode: c.postalCode ?? "",
    city: c.city ?? "",
    notes: c.notes ?? "",
    kundenNummer: c.kundenNummer ?? "",
  };
}

export function KontaktePageClient() {
  const contactsQuery = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const historyQuery = useContactProjects(historyContact?.id ?? null, historyContact !== null);

  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const pending = createContact.isPending || updateContact.isPending;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.displayName, c.companyName, c.email, c.city, c.kundenNummer].some(
        (f) => f != null && f.toLowerCase().includes(q),
      ),
    );
  }, [contacts, query]);

  const submit = async () => {
    if (!form) return;
    const payload = {
      kind: form.kind,
      displayName: form.displayName,
      companyName: form.companyName || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile: form.mobile || null,
      street: form.street || null,
      postalCode: form.postalCode || null,
      city: form.city || null,
      notes: form.notes || null,
      kundenNummer: form.kundenNummer || null,
    };
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
      return;
    }
    try {
      if (form.id) {
        await updateContact.mutateAsync({ ...payload, id: form.id });
        toast.success("Kontakt aktualisiert");
      } else {
        await createContact.mutateAsync(payload);
        toast.success("Kontakt erstellt");
      }
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const remove = async (contact: Contact) => {
    try {
      await deleteContact.mutateAsync(contact.id);
      toast.success("Kontakt gelöscht");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kontakte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kunden, Mieter, Verwaltungen und Lieferanten — einmal erfassen, später auswählen.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="size-4" aria-hidden />
          Neuer Kontakt
        </Button>
      </div>

      <div className="relative my-4">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, Firma, Ort oder Kundennummer suchen …"
          className="pl-8"
          aria-label="Kontakte durchsuchen"
        />
      </div>

      {contactsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Kontakte werden geladen …</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
          {contacts.length === 0
            ? "Noch keine Kontakte. Lege oben deinen ersten Kontakt an."
            : "Kein Kontakt passt zur Suche."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border/70">
          {filtered.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {c.displayName}
                  <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                    {contactKindLabels[c.kind]}
                  </Badge>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[c.companyName, [c.postalCode, c.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(" · ")}
                  {c.kundenNummer ? ` · Nr. ${c.kundenNummer}` : ""}
                </p>
                {c.email || c.phone ? (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {c.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="size-3" aria-hidden />
                        {c.email}
                      </span>
                    ) : null}
                    {c.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3" aria-hidden />
                        {c.phone}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Verlauf"
                  title="Verknüpfte Projekte"
                  onClick={() => setHistoryContact(c)}
                >
                  <History className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Bearbeiten"
                  onClick={() => setForm(fromContact(c))}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label="Löschen"
                  disabled={deleteContact.isPending}
                  onClick={() => remove(c)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={form !== null}
        onOpenChange={(o) => (o ? null : setForm(null))}
        title={form?.id ? "Kontakt bearbeiten" : "Neuer Kontakt"}
        description="Nur der Name ist Pflicht — alles andere optional."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setForm(null)}>
              Abbrechen
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {form?.id ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        }
      >
        {form ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs" htmlFor="contact-kind">
                  Typ
                </Label>
                <select
                  id="contact-kind"
                  value={form.kind}
                  onChange={(e) =>
                    setForm((p) => (p ? { ...p, kind: e.target.value as ContactKind } : p))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {contactKinds.map((k) => (
                    <option key={k} value={k}>
                      {contactKindLabels[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Kundennummer (optional)</Label>
                <Input
                  value={form.kundenNummer}
                  onChange={(e) => setForm((p) => (p ? { ...p, kundenNummer: e.target.value } : p))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.displayName}
                  placeholder="Familie Muster / M. Muster"
                  onChange={(e) => setForm((p) => (p ? { ...p, displayName: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-xs">Firma (optional)</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => setForm((p) => (p ? { ...p, companyName: e.target.value } : p))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">E-Mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => (p ? { ...p, email: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-xs">Telefon</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => (p ? { ...p, phone: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-xs">Mobile</Label>
                <Input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm((p) => (p ? { ...p, mobile: e.target.value } : p))}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px_1fr] gap-2">
              <div>
                <Label className="text-xs">Strasse</Label>
                <Input
                  value={form.street}
                  onChange={(e) => setForm((p) => (p ? { ...p, street: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-xs">PLZ</Label>
                <Input
                  value={form.postalCode}
                  onChange={(e) => setForm((p) => (p ? { ...p, postalCode: e.target.value } : p))}
                />
              </div>
              <div>
                <Label className="text-xs">Ort</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((p) => (p ? { ...p, city: e.target.value } : p))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notiz (optional)</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((p) => (p ? { ...p, notes: e.target.value } : p))}
              />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={historyContact !== null}
        onOpenChange={(o) => (o ? null : setHistoryContact(null))}
        title={
          historyContact ? `Projekte — ${historyContact.displayName}` : "Verknüpfte Projekte"
        }
        description="Projekte, bei denen dieser Kontakt als Mieter oder Verwaltung hinterlegt ist."
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setHistoryContact(null)}>
              Schliessen
            </Button>
          </div>
        }
      >
        {historyQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine verknüpften Projekte.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(historyQuery.data ?? []).map((p) => (
              <li key={`${p.projectId}-${p.role}`} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{p.title || "Projekt"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.role === "verwaltung" ? "Verwaltung" : "Mieter"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                  {p.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
