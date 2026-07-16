import { redirect } from "next/navigation";
import { KontaktePageClient } from "@/components/app/kontakte-page-client";
import { getLayoutSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function KontaktePage() {
  const session = await getLayoutSession();
  if (!session || (session.role !== "admin" && session.role !== "office")) {
    redirect("/projekte");
  }
  if (!session.organizationId) {
    redirect("/onboarding");
  }

  return <KontaktePageClient />;
}
