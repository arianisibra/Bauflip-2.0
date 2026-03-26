import Link from "next/link";
import { notFound } from "next/navigation";
import { getContactWithDetails } from "@/lib/db/repository";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

const categoryLabel: Record<string, string> = {
  kunde: "Kunde",
  lieferant: "Lieferant",
  partner: "Partner",
  sonstiges: "Sonstiges",
};

export default async function KontaktDetailPage({ params }: Props) {
  const { id } = await params;
  const bundle = await getContactWithDetails(id);
  if (!bundle) {
    notFound();
  }

  const { contact, persons, addresses, siteProperties } = bundle;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {contact.partyKind === "firma" ? "Firma" : "Privat"} ·{" "}
            {categoryLabel[contact.category] ?? contact.category}
            {contact.contactNumber ? ` · Nr. ${contact.contactNumber}` : null}
          </p>
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/kontakte" />}>
          Alle Kontakte
        </Button>
      </div>

      <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">UID</h2>
          <p>{contact.uidNumber ?? "—"}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Objekt</h2>
          <p>{contact.managedObjectLabel ?? "—"}</p>
        </div>
        <div className="md:col-span-2">
          <h2 className="text-sm font-medium text-muted-foreground">Adresse</h2>
          <p>
            {[contact.street, `${contact.postalCode ?? ""} ${contact.city ?? ""}`.trim()]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Telefon</h2>
          <p>{contact.phone ?? "—"}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Mobil</h2>
          <p>{contact.mobile ?? "—"}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">E-Mail</h2>
          <p>{contact.email ?? "—"}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Web</h2>
          <p>
            {contact.website ? (
              <a href={contact.website} className="text-primary underline" target="_blank" rel="noreferrer">
                {contact.website}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      {persons.length > 0 ? (
        <div>
          <h2 className="mb-2 text-lg font-medium">Ansprechpartner</h2>
          <ul className="flex flex-col gap-3">
            {persons.map((p) => (
              <li key={p.id} className="rounded-lg border bg-white p-3">
                <p className="font-medium">
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[p.roleTitle, p.phone, p.mobile, p.email].filter(Boolean).join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {addresses.length > 0 ? (
        <div>
          <h2 className="mb-2 text-lg font-medium">Weitere Adressen</h2>
          <ul className="flex flex-col gap-3">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-lg border bg-white p-3">
                <p className="font-medium">
                  {a.label}
                  {a.isPrimary ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(Primär)</span>
                  ) : null}
                </p>
                <p className="text-sm">
                  {[a.street, `${a.postalCode ?? ""} ${a.city ?? ""}`.trim(), a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {siteProperties.length > 0 ? (
        <div>
          <h2 className="mb-2 text-lg font-medium">Objekte (Standorte)</h2>
          <ul className="flex flex-col gap-3">
            {siteProperties.map((sp) => (
              <li key={sp.id} className="rounded-lg border bg-white p-3">
                <p className="font-medium">{sp.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[sp.street, `${sp.postalCode ?? ""} ${sp.city ?? ""}`.trim(), sp.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
                {sp.mapsUrl ? (
                  <a href={sp.mapsUrl} className="mt-1 inline-block text-sm text-primary underline" target="_blank" rel="noreferrer">
                    Google Maps öffnen
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
