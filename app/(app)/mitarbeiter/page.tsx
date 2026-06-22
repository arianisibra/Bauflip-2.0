import { redirect } from "next/navigation";
import { MitarbeiterPageClient } from "@/components/app/mitarbeiter-page-client";
import { getLayoutSession } from "@/lib/auth/session";

export default async function MitarbeiterPage() {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    redirect("/projekte");
  }
  return <MitarbeiterPageClient />;
}
