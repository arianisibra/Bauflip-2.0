import {
  decideOrganizationApproval,
  type OrganizationApprovalDecisionResult,
} from "@/lib/db/organization-approval";
import { isMailConfigured, sendMail } from "@/lib/mail/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Öffentlicher Freigabe-/Ablehnungs-Endpunkt für den Link aus der
 * Betreiber-Benachrichtigungsmail (siehe registrieren/actions.ts). Der Token
 * IST die Authentisierung (Capability-URL, kein Login nötig — der Link geht
 * ausschliesslich an REGISTRATION_APPROVAL_NOTIFY_EMAIL). Kein JSON: ein
 * Mensch klickt diesen Link im Browser/E-Mail-Client, daher eine einfache
 * HTML-Antwortseite.
 */

function htmlPage(title: string, message: string, tone: "ok" | "error"): Response {
  const color = tone === "ok" ? "#16a34a" : "#dc2626";
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; color: #18181b; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
  main { max-width: 28rem; text-align: center; }
  h1 { font-size: 1.25rem; color: ${color}; margin-bottom: 0.5rem; }
  p { color: #52525b; line-height: 1.5; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <p>${message}</p>
</main>
</body>
</html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function notifyRegistrantOfDecision(
  result: OrganizationApprovalDecisionResult,
): Promise<void> {
  if (!isMailConfigured() || !result.createdByUserId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data } = await admin.auth.admin.getUserById(result.createdByUserId);
  const email = data?.user?.email;
  if (!email) return;

  const text =
    result.decision === "approved"
      ? `Guten Tag\n\nIhre Firma «${result.organizationName}» wurde freigeschaltet. Sie können sich jetzt einloggen und Bauflip nutzen.\n\nFreundliche Grüsse`
      : `Guten Tag\n\nIhre Registrierung für «${result.organizationName}» konnte leider nicht freigeschaltet werden. Bei Fragen melden Sie sich gerne bei uns.\n\nFreundliche Grüsse`;

  await sendMail({
    to: email,
    subject:
      result.decision === "approved"
        ? `Ihre Firma «${result.organizationName}» ist freigeschaltet`
        : `Ihre Registrierung für «${result.organizationName}»`,
    text,
  }).catch((err) => {
    console.error("[bauflip] Freigabe-Entscheidungs-Mail an Registranten fehlgeschlagen:", err);
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  const entscheid = url.searchParams.get("entscheid");

  if (!token || (entscheid !== "freigeben" && entscheid !== "ablehnen")) {
    return htmlPage("Ungültiger Link", "Dieser Freigabe-Link ist unvollständig oder ungültig.", "error");
  }

  const decision = entscheid === "freigeben" ? "approved" : "rejected";

  let result: OrganizationApprovalDecisionResult | null;
  try {
    result = await decideOrganizationApproval(token, decision);
  } catch {
    return htmlPage(
      "Fehler",
      "Die Entscheidung konnte nicht gespeichert werden. Bitte später erneut versuchen.",
      "error",
    );
  }

  if (!result) {
    return htmlPage(
      "Bereits bearbeitet",
      "Dieser Link wurde bereits verwendet oder ist abgelaufen — die Firma wurde entweder schon freigegeben/abgelehnt oder der Link ist ungültig.",
      "error",
    );
  }

  void notifyRegistrantOfDecision(result);

  return decision === "approved"
    ? htmlPage(
        "Freigegeben",
        `«${result.organizationName}» wurde freigeschaltet. Der Kunde wurde per Mail informiert.`,
        "ok",
      )
    : htmlPage(
        "Abgelehnt",
        `«${result.organizationName}» wurde abgelehnt. Der Kunde wurde per Mail informiert.`,
        "error",
      );
}
