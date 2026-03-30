import { NextResponse } from "next/server";
import { addAuditEvent } from "@/lib/db/repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyZapierSignature } from "@/lib/integrations/zapier";

type InboundEnvelope = {
  eventType?: unknown;
  payload?: unknown;
};

export async function POST(req: Request) {
  const organizationId = req.headers.get("x-bauflip-org-id");
  const signature = req.headers.get("x-bauflip-signature");
  if (!organizationId) {
    return NextResponse.json({ ok: false, message: "Header x-bauflip-org-id fehlt." }, { status: 400 });
  }

  const raw = await req.text();
  let body: InboundEnvelope;
  try {
    body = JSON.parse(raw) as InboundEnvelope;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const supabase = (createSupabaseAdminClient() ?? (await createSupabaseServerClient())) as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >;
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase ist nicht verfügbar." }, { status: 500 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("zapier_signing_secret")
    .eq("id", organizationId)
    .maybeSingle();
  const secret = String(org?.zapier_signing_secret ?? "").trim();
  if (!secret || !verifyZapierSignature(secret, raw, signature)) {
    return NextResponse.json({ ok: false, message: "Signaturprüfung fehlgeschlagen." }, { status: 401 });
  }

  const eventType = typeof body.eventType === "string" ? body.eventType : "zapier.inbound";
  const payload = body.payload && typeof body.payload === "object" ? (body.payload as Record<string, unknown>) : {};
  const projectId = typeof payload.projectId === "string" ? payload.projectId : null;

  await addAuditEvent({
    action: "zapier_webhook_empfangen",
    projectId,
    actorRole: "admin",
    actorName: "Zapier",
    payload: JSON.stringify({ eventType, payload }),
  });

  return NextResponse.json({ ok: true });
}

