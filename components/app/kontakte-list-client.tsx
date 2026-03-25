"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Contact } from "@/lib/domain/types";
import { buttonVariants } from "@/components/ui/button-variants";
import { KontaktSheetEditor } from "@/components/app/kontakt-sheet-editor";
import { ListPageToolbar } from "@/components/app/list-page-toolbar";
import { Sheet } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const categoryLabel: Record<string, string> = {
  kunde: "Kunde",
  lieferant: "Lieferant",
  partner: "Partner",
  sonstiges: "Sonstiges",
};

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export function KontakteListClient({ contacts }: { contacts: Contact[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) {
      return contacts;
    }
    const n = normalize(q);
    return contacts.filter((c) => {
      return (
        normalize(c.name).includes(n) ||
        (c.contactNumber && normalize(c.contactNumber).includes(n)) ||
        (c.email && normalize(c.email).includes(n)) ||
        (c.city && normalize(c.city).includes(n)) ||
        normalize(categoryLabel[c.category] ?? c.category).includes(n)
      );
    });
  }, [contacts, q]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold">Kontakte</h1>
          <Link
            href="/import-export#kontakte-import"
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            CSV Import / Export
          </Link>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <ListPageToolbar value={q} onChange={setQ} placeholder="Name, Nr., E-Mail, Ort …" />
          <Link href="/kontakte/neu" className={buttonVariants()}>
            Neuer Kontakt
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nr.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Ort</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(c);
                  setOpen(true);
                }}
              >
                <TableCell className="tabular-nums text-muted-foreground">{c.contactNumber ?? "—"}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.partyKind === "firma" ? "Firma" : "Privat"}</TableCell>
                <TableCell>{categoryLabel[c.category] ?? c.category}</TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{c.city ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
          }
        }}
        className="max-w-xl"
        title={selected?.name ?? "Kontakt"}
        description={
          selected
            ? `${selected.partyKind === "firma" ? "Firma" : "Privat"} · ${categoryLabel[selected.category] ?? selected.category}`
            : undefined
        }
      >
        {selected ? (
          <KontaktSheetEditor contactId={selected.id} open={open} />
        ) : null}
      </Sheet>
    </>
  );
}
