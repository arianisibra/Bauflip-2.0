import { NextResponse } from "next/server";
import { buildArticleTemplateCsv, buildContactTemplateCsv } from "@/lib/integrations/csv";
import { getCurrentSession } from "@/lib/auth/session";

type Params = {
  params: Promise<{ type: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const role = session.role;
  const allowed = role === "admin" || role === "office";

  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  const { type } = await params;
  if (type === "contacts") {
    const csv = buildContactTemplateCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bauflip-kontakte-vorlage.csv"',
      },
    });
  }

  if (type === "articles") {
    const csv = buildArticleTemplateCsv();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bauflip-artikel-vorlage.csv"',
      },
    });
  }

  return NextResponse.json({ error: "Ungültiger Typ." }, { status: 400 });
}
