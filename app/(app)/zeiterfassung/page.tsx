import { redirect } from "next/navigation";
import { ZeiterfassungPageClient } from "@/components/app/zeiterfassung-page-client";
import { getLayoutSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ZeiterfassungPage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  return <ZeiterfassungPageClient />;
}
