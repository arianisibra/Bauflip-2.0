import { getCurrentProfile } from "@/lib/auth/session";
import { ProfileSettingsForm } from "@/components/app/profile-settings-form";
import { hasSupabaseConfig } from "@/lib/supabase/server";

export default async function EinstellungenPage() {
  const profile = await getCurrentProfile();
  const supabaseConfigured = hasSupabaseConfig();

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profil und Kalenderdarstellung.</p>
      </header>

      <ProfileSettingsForm profile={profile} supabaseConfigured={supabaseConfigured} />
    </section>
  );
}
