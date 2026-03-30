import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { generateTechnicianReportPdf } from "@/lib/documents/project-document-pdf";
import { getProjectBundle, getTechnicianReportById, listSupplierTemplates } from "@/lib/db/repository";

function safeFilePart(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return new NextResponse("Nicht angemeldet.", { status: 401 });
  }

  const { reportId } = await params;
  const report = await getTechnicianReportById(reportId);
  if (!report) {
    return new NextResponse("Rapport nicht gefunden.", { status: 404 });
  }

  const bundle = await getProjectBundle(report.projectId);
  if (!bundle) {
    return new NextResponse("Projekt nicht gefunden.", { status: 404 });
  }

  const supplierTemplates = await listSupplierTemplates();

  const bytes = await generateTechnicianReportPdf(
    {
      project: bundle.project,
      contactName: bundle.contact?.name ?? "—",
      contactEmail: bundle.contact?.email ?? null,
      contactPhone: bundle.contact?.phone ?? null,
    },
    report,
    {
      supplierSubmissions: bundle.supplierSubmissions ?? [],
      supplierTemplates,
    },
  );

  const stamp = new Date(report.createdAt).toISOString().slice(0, 10);
  const name = safeFilePart(`rapport_${bundle.project.title}_${stamp}`) || "rapport";

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

