import { redirect } from "next/navigation";
import { ZahlungenPageClient } from "@/components/app/zahlungen-page-client";
import { getLayoutSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ZahlungenPage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  return <ZahlungenPageClient />;
}
