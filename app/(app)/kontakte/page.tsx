import { listContacts } from "@/lib/db/repository";
import { KontakteListClient } from "@/components/app/kontakte-list-client";

export default async function KontaktePage() {
  const contacts = await listContacts();

  return (
    <section className="flex flex-col gap-4">
      <KontakteListClient contacts={contacts} />
    </section>
  );
}
