import { NextResponse } from "next/server";
import { listArticles, listContacts } from "@/lib/db/repository";
import { getCurrentSession } from "@/lib/auth/session";
import { articlesToStandardCsv, contactsToStandardCsv } from "@/lib/integrations/csv";

type Params = {
  params: Promise<{ type: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const role = session.role;
  const canExport = role === "admin" || role === "office";

  if (!canExport) {
    return NextResponse.json({ error: "Kein Zugriff auf Export." }, { status: 403 });
  }

  const { type } = await params;
  const isContacts = type === "customers" || type === "contacts";
  if (!isContacts && type !== "articles") {
    return NextResponse.json({ error: "Ungültiger Exporttyp." }, { status: 400 });
  }

  const csv = isContacts ? contactsToStandardCsv(await listContacts()) : articlesToStandardCsv(await listArticles());
  const filename = type === "customers" ? "contacts" : type;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}.csv\"`,
    },
  });
}
