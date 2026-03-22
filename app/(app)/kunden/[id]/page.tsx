import { notFound } from "next/navigation";
import { listCustomers } from "@/lib/db/repository";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function KundeDetailPage({ params }: Params) {
  const { id } = await params;
  const customers = await listCustomers();
  const customer = customers.find((item) => item.id === id);

  if (!customer) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{customer.name}</h1>
      <p className="text-sm text-muted-foreground">
        Telefon: {customer.phone ?? "-"} · E-Mail: {customer.email ?? "-"}
      </p>
    </section>
  );
}
