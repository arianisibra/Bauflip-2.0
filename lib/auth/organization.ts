import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminMfaRequiredAndMissing, resolveAdminMfaGatePath } from "@/lib/auth/mfa";
import { syncUserAuthMetadata } from "@/lib/auth/sync-user-auth-metadata";
import { getLayoutSession, type LayoutSession } from "@/lib/auth/session";
import { getOrganizationApprovalStatus } from "@/lib/db/organization-approval";
import { canAccessTechFieldRoutes, type RoleType } from "@/lib/domain/types";

function isOfficeRole(role: RoleType): boolean {
  return role === "office" || role === "admin";
}

/**
 * Zweiten Faktor erzwingen, wo die Berechtigung geprüft wird — nicht im Layout.
 *
 * Der Layout-Redirect auf /mfa/setup schützt nur den Weg über den Browser.
 * Server Actions rufen kein Layout auf: Ein POST mit dem `Next-Action`-Header
 * führt die Aktion direkt aus. Wer ein Admin-Passwort erbeutet hat, umging die
 * MFA-Pflicht also schlicht, indem er die Seite nie öffnete — und hatte Zugriff
 * auf Einladungen, Deaktivierungen und alles Weitere. Dasselbe galt für die
 * API-Routen.
 *
 * Deshalb sitzt die Prüfung jetzt hier: Jede Aktion, die eine Berechtigung
 * verlangt, kommt hier vorbei.
 */
async function ensureMfaSatisfied(session: LayoutSession): Promise<void> {
  if (await isAdminMfaRequiredAndMissing(session)) {
    throw new Error("Zweiter Faktor erforderlich. Bitte zuerst die Anmeldung in zwei Schritten einrichten.");
  }
}

/**
 * Freigabe-Workflow: eine selbstregistrierte Firma hat sofort eine gültige
 * Sitzung, darf aber erst nach Freigabe durch den Betreiber echte Aktionen
 * ausführen. Ohne diese Prüfung würde nur die UI (app/(app)/layout.tsx)
 * sperren — Server Actions sind öffentliche HTTP-Endpunkte und liessen sich
 * mit dem Next-Action-Header direkt aufrufen, am Layout vorbei (dasselbe
 * Muster wie ensureMfaSatisfied()).
 */
async function ensureOrganizationApproved(session: LayoutSession): Promise<void> {
  if (!session.organizationId) return;
  const { status } = await getOrganizationApprovalStatus(session.organizationId);
  if (status !== "approved") {
    throw new Error("Ihre Firma wartet noch auf Freigabe durch den Betreiber.");
  }
}

/**
 * MFA-Gate für SSR-Seiten (page.tsx), die dieselben Daten liefern wie eine
 * abgesicherte Server Action. `app/(app)/layout.tsx` prüft den zweiten Faktor
 * nur beim ersten Rendern — Next.js re-rendert Layouts bei Client-Navigation
 * nicht ("Layouts do not re-render on navigation"), eine Segment-Anfrage an
 * die Seite selbst geht am Layout-Redirect vorbei. Jede Seite, die
 * organisationsweite Daten SSR-vorlädt, muss diese Prüfung deshalb selbst
 * wiederholen — analog zu ensureMfaSatisfied() für Server Actions, aber mit
 * Redirect statt Exception, da Seiten keinen Fehlerzustand rendern.
 */
export async function ensurePageMfaSatisfied(session: LayoutSession): Promise<void> {
  const gatePath = await resolveAdminMfaGatePath(session);
  if (gatePath) {
    redirect(gatePath);
  }
}

/** Read/monitor paths: proxy headers + cookie session, no profile DB. */
export async function requireOfficeSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || !isOfficeRole(session.role)) {
    throw new Error("Keine Berechtigung.");
  }
  await ensureMfaSatisfied(session);
  await ensureOrganizationApproved(session);
  return session;
}

export async function getOfficeSessionOrNull(): Promise<LayoutSession | null> {
  const session = await getLayoutSession();
  if (!session || !isOfficeRole(session.role)) return null;
  // Auch hier prüfen: Diese Variante bedient u. a. die PDF-Routen, die sonst
  // ohne zweiten Faktor Offerten und Rechnungen herausgäben.
  if (await isAdminMfaRequiredAndMissing(session)) return null;
  if (session.organizationId) {
    const { status } = await getOrganizationApprovalStatus(session.organizationId);
    if (status !== "approved") return null;
  }
  return session;
}

export async function requireAdminLayoutSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || session.role !== "admin") {
    throw new Error("Nur Admins dürfen diese Aktion ausführen.");
  }
  await ensureMfaSatisfied(session);
  await ensureOrganizationApproved(session);
  return session;
}

export async function requireTechFieldSession(): Promise<LayoutSession> {
  const session = await getLayoutSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) {
    throw new Error("Keine Berechtigung.");
  }
  return session;
}

export async function getTechFieldSessionOrNull(): Promise<LayoutSession | null> {
  const session = await getLayoutSession();
  if (!session || !canAccessTechFieldRoutes(session.role)) return null;
  return session;
}

export async function requireOrgLayoutSession(): Promise<LayoutSession & { organizationId: string }> {
  const session = await getLayoutSession();
  if (!session?.organizationId) {
    throw new Error("Nicht angemeldet.");
  }
  await ensureMfaSatisfied(session);
  await ensureOrganizationApproved(session);
  return session as LayoutSession & { organizationId: string };
}

export async function requireAdminSession() {
  return requireAdminLayoutSession();
}

export async function ensureCurrentOrganizationId() {
  const session = await requireAdminLayoutSession();
  if (session.organizationId) {
    return session.organizationId;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: "Bauflip Organisation",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (orgError || !organization) {
    throw new Error("Organisation konnte nicht erstellt werden.");
  }

  const { error: membershipError } = await supabase.from("organization_memberships").insert({
    organization_id: organization.id,
    user_id: session.userId,
    role: "admin",
    is_active: true,
  });

  if (membershipError) {
    throw new Error("Admin-Mitgliedschaft konnte nicht erstellt werden.");
  }

  await syncUserAuthMetadata(session.userId, "admin", organization.id as string);

  return organization.id as string;
}
