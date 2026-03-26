import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getProjectDocumentSignedUrl } from "@/lib/db/repository";

type Params = {
  params: Promise<{ type: string; id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const { type, id } = await params;
  if (type !== "quote" && type !== "invoice" && type !== "delivery") {
    return NextResponse.json({ error: "Ungültiger Dokumenttyp." }, { status: 400 });
  }

  const signedUrl = await getProjectDocumentSignedUrl({ type, id });
  if (!signedUrl) {
    return NextResponse.json({ error: "Dokument nicht gefunden." }, { status: 404 });
  }
  return NextResponse.redirect(signedUrl);
}
