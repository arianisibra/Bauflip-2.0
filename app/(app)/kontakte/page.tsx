import { listCustomers } from "@/lib/db/repository";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function KontaktePage() {
  const customers = await listCustomers();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Kontakte</h1>
      <Table>
        <TableCaption>Kontaktliste für Telefon, E-Mail und schnelle Rückfragen.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Ort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">{customer.name}</TableCell>
              <TableCell>{customer.phone ?? "-"}</TableCell>
              <TableCell>{customer.email ?? "-"}</TableCell>
              <TableCell>{customer.city ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
