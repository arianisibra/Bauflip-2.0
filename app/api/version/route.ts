import { NextResponse } from "next/server";

/**
 * Aktuelle Deployment-Kennung des Servers. Der Client vergleicht sie mit der
 * Kennung, die zur Bauzeit in sein Bundle eingebacken wurde; weichen sie ab,
 * läuft er in einem veralteten Tab und muss neu laden.
 *
 * Bewusst ohne Sitzungsprüfung und ohne Datenzugriff: Der Wert ist ein
 * Git-Kurz-SHA und steht ohnehin in jeder Asset-URL (`?dpl=`).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { deploymentId: process.env.NEXT_PUBLIC_DEPLOYMENT_ID ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
