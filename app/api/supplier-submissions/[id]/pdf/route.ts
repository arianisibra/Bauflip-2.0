import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateSupplierSubmissionPdf } from "@/lib/documents/project-document-pdf";
import {
  getProjectBundle,
  getSupplierOrderSubmissionById,
  getSupplierOrderTemplateById,
} from "@/lib/db/repository";
import type { SupplierOrderTemplate } from "@/lib/domain/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (session.role !== "office" && session.role !== "admin") {
    return NextResponse.json({ error: "Nur Büro oder Admin können das PDF abrufen." }, { status: 403 });
  }

  const { id: submissionId } = await params;
  const id = submissionId?.trim();
  if (!id) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  const submission = await getSupplierOrderSubmissionById(id);
  if (!submission) {
    return NextResponse.json({ error: "Bestellformular nicht gefunden." }, { status: 404 });
  }

  const bundle = await getProjectBundle(submission.projectId);
  if (!bundle) {
    return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
  }

  let template = await getSupplierOrderTemplateById(submission.templateId);
  if (!template) {
    const fallback: SupplierOrderTemplate = {
      id: submission.templateId,
      supplierId: "",
      supplierName: "Lieferant",
      name: "Bestellformular",
      requiredFields: [],
      fieldDefinitions: [],
    };
    template = fallback;
  }

  const pdfBundle = {
    project: bundle.project,
    contactName: bundle.contact?.name ?? "Unbekannt",
    contactEmail: bundle.contact?.email ?? null,
    contactPhone: bundle.contact?.phone ?? null,
  };

  const bytes = await generateSupplierSubmissionPdf(pdfBundle, submission, template);
  const safeName = `bestellformular-${id.slice(0, 8)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
