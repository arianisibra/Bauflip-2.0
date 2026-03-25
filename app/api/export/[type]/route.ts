import { NextResponse } from "next/server";
import { listArticles, listCustomers } from "@/lib/db/repository";
import { getCurrentRole, getCurrentSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/integrations/csv";

type Params = {
  params: Promise<{ type: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const session = await getCurrentSession();
  const role = await getCurrentRole();
  const canExport = role === "admin" || role === "office";

  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  if (!canExport) {
    return NextResponse.json({ error: "Kein Zugriff auf Export." }, { status: 403 });
  }

  const { type } = await params;
  if (type !== "customers" && type !== "articles") {
    return NextResponse.json({ error: "Ungültiger Exporttyp." }, { status: 400 });
  }

  const csv =
    type === "customers" ? toCsv(await listCustomers()) : toCsv(await listArticles());

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${type}.csv\"`,
    },
  });
}
