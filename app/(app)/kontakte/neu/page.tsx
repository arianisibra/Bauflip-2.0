import Link from "next/link";
import { ContactForm } from "@/components/app/contact-form";
import { Button } from "@/components/ui/button";

export default function KontaktNeuPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Neuer Kontakt</h1>
        <Button nativeButton={false} variant="outline" render={<Link href="/kontakte" />}>
          Zurück zur Liste
        </Button>
      </div>
      <ContactForm />
    </section>
  );
}
