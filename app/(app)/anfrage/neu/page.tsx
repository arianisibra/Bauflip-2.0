import { IntakeForm } from "@/components/app/intake-form";

export default function NeueAnfragePage() {
  return (
    <section className="mx-auto w-full max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">Neue Anfrage</h1>
      <IntakeForm />
    </section>
  );
}
