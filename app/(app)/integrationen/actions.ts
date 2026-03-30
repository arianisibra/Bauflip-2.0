"use server";

import { revalidatePath } from "next/cache";
import { ensureCurrentOrganizationId, requireAdminSession } from "@/lib/auth/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BAUFLIP_ZAPIER_EVENTS } from "@/lib/integrations/zapier-events";
import { dispatchZapierEvent, markZapierTest } from "@/lib/integrations/zapier";

function sanitizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "";
    }
    return u.toString();
  } catch {
    return "";
  }
}

export async function saveZapierSettingsAction(formData: FormData) {
  await requireAdminSession();
  const organizationId = await ensureCurrentOrganizationId();
  const enabled = String(formData.get("zapierEnabled") ?? "") === "on";
  const webhookUrl = sanitizeUrl(String(formData.get("zapierWebhookUrl") ?? ""));
  const secret = String(formData.get("zapierSigningSecret") ?? "").trim();

  if (enabled && !webhookUrl) {
    throw new Error("Bitte eine gültige Zapier Webhook-URL angeben.");
  }
  if (enabled && secret.length < 12) {
    throw new Error("Bitte ein Signatur-Secret mit mindestens 12 Zeichen verwenden.");
  }

  const supabase = (createSupabaseAdminClient() ?? (await createSupabaseServerClient())) as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >;
  if (!supabase) {
    throw new Error("Supabase ist nicht konfiguriert.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      zapier_enabled: enabled,
      zapier_webhook_url: webhookUrl || null,
      zapier_signing_secret: secret || null,
      zapier_last_error: null,
    })
    .eq("id", organizationId);
  if (error) {
    throw new Error("Zapier-Einstellungen konnten nicht gespeichert werden.");
  }

  revalidatePath("/integrationen");
}

export async function testZapierConnectionAction() {
  await requireAdminSession();
  const organizationId = await ensureCurrentOrganizationId();

  const result = await dispatchZapierEvent({
    organizationId,
    eventType: BAUFLIP_ZAPIER_EVENTS.INTEGRATION_TEST,
    payload: {
      message: "Test aus BauFlip Integrationen",
      sentAt: new Date().toISOString(),
      bexioContactIdNumeric: null,
      contactName: null,
      contactEmail: null,
      projectId: null,
      lineItems: [
        {
          description: "Beispielposition (Test)",
          quantity: 1,
          unit: "Stk",
          unitPrice: 0,
          bexioArticleId: null,
          bexioArticleIdNumeric: null,
        },
      ],
    },
  });

  if (!result.ok && "skipped" in result && result.skipped) {
    await markZapierTest(organizationId, false, result.message);
    throw new Error(result.message);
  }
  if (!result.ok) {
    await markZapierTest(organizationId, false, result.message);
    throw new Error(result.message);
  }

  await markZapierTest(organizationId, true);
  revalidatePath("/integrationen");
}

