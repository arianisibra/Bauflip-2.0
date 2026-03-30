import { createHmac, randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ZapierDispatchInput = {
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

type ZapierDispatchResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; message: string }
  | { ok: false; skipped: true; message: string };

function signBody(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function loadOrganizationZapierConfig(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("organizations")
    .select("id, zapier_enabled, zapier_webhook_url, zapier_signing_secret")
    .eq("id", organizationId)
    .maybeSingle();
  return (data ?? null) as
    | {
        id: string;
        zapier_enabled: boolean | null;
        zapier_webhook_url: string | null;
        zapier_signing_secret: string | null;
      }
    | null;
}

async function writeIntegrationHealth(organizationId: string, patch: Record<string, unknown>) {
  const supabase = (createSupabaseAdminClient() ?? (await createSupabaseServerClient())) as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >;
  if (!supabase) {
    return;
  }
  await supabase.from("organizations").update(patch).eq("id", organizationId);
}

export async function dispatchZapierEvent(input: ZapierDispatchInput): Promise<ZapierDispatchResult> {
  const cfg = await loadOrganizationZapierConfig(input.organizationId);
  if (!cfg) {
    return { ok: false, skipped: true, message: "Organisation nicht gefunden." };
  }
  if (!cfg.zapier_enabled) {
    return { ok: false, skipped: true, message: "Zapier ist deaktiviert." };
  }
  const webhookUrl = String(cfg.zapier_webhook_url ?? "").trim();
  const signingSecret = String(cfg.zapier_signing_secret ?? "").trim();
  if (!webhookUrl || !signingSecret) {
    return { ok: false, skipped: true, message: "Webhook-URL oder Signatur-Secret fehlt." };
  }

  /** JSON body: root `eventType` mirrors `X-Bauflip-Event` — use either for Zapier Paths / Filter. */
  const envelope = {
    id: randomUUID(),
    source: "bauflip",
    eventType: input.eventType,
    occurredAt: new Date().toISOString(),
    organizationId: input.organizationId,
    payload: input.payload,
  } as const;
  const raw = JSON.stringify(envelope);
  const signature = signBody(signingSecret, raw);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bauflip-Event": input.eventType,
        "X-Bauflip-Org-Id": input.organizationId,
        "X-Bauflip-Signature": signature,
      },
      body: raw,
      cache: "no-store",
    });

    if (!response.ok) {
      const message = `Zapier HTTP ${response.status}`;
      await writeIntegrationHealth(input.organizationId, {
        zapier_last_error: message,
      });
      return { ok: false, status: response.status, message };
    }

    await writeIntegrationHealth(input.organizationId, {
      zapier_last_error: null,
    });
    return { ok: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook-Versand fehlgeschlagen.";
    await writeIntegrationHealth(input.organizationId, {
      zapier_last_error: message,
    });
    return { ok: false, message };
  }
}

export async function markZapierTest(organizationId: string, ok: boolean, message?: string) {
  await writeIntegrationHealth(organizationId, {
    zapier_last_test_at: new Date().toISOString(),
    zapier_last_error: ok ? null : message ?? "Test fehlgeschlagen.",
  });
}

export function verifyZapierSignature(secret: string, rawBody: string, provided: string | null) {
  if (!provided) {
    return false;
  }
  const expected = signBody(secret, rawBody);
  return provided === expected;
}

