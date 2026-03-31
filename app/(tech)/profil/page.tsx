import { getCurrentSession } from "@/lib/auth/session";
import { TechProfileClient } from "@/components/app/tech-profile-client";

export default async function TechProfilePage() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const profile = session.profile;

  return (
    <TechProfileClient
      displayName={profile.displayName ?? null}
      email={profile.email ?? null}
    />
  );
}

