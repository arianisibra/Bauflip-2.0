import { getCurrentProfile, getCurrentSession } from "@/lib/auth/session";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { hasSupabaseConfig } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EinstellungenPage() {
  const [profile, session] = await Promise.all([getCurrentProfile(), getCurrentSession()]);
  const supabaseConfigured = hasSupabaseConfig();
  let organizationBilling: {
    companyName: string;
    iban: string;
    creditorName: string;
    creditorStreet: string;
    creditorPostalCode: string;
    creditorCity: string;
  } | null = null;

  if (session?.organizationId) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from("organizations")
        .select(
          "name, billing_iban, billing_creditor_name, billing_creditor_street, billing_creditor_postal_code, billing_creditor_city",
        )
        .eq("id", session.organizationId)
        .maybeSingle();
      const row = (data ?? {}) as Record<string, unknown>;
      organizationBilling = {
        companyName: String(row.name ?? ""),
        iban: String(row.billing_iban ?? ""),
        creditorName: String(row.billing_creditor_name ?? ""),
        creditorStreet: String(row.billing_creditor_street ?? ""),
        creditorPostalCode: String(row.billing_creditor_postal_code ?? ""),
        creditorCity: String(row.billing_creditor_city ?? ""),
      };
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil und Kalenderdarstellung.</p>
      </header>

      <ProfileSettingsForm
        profile={profile}
        supabaseConfigured={supabaseConfigured}
        canEditCompanySettings={session?.role === "admin"}
        organizationBilling={organizationBilling}
      />
    </section>
  );
}
