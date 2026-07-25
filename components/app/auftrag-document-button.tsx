"use client";

import { FileType } from "lucide-react";
import { useHasAuftragDocumentTemplate } from "@/lib/query/hooks";
import { buttonVariants } from "@/components/ui/button";

/**
 * «Als Word (Auftrag)» — lädt den Auftrag aus der Org-Vorlage als .docx.
 * Rendert nichts, wenn keine Auftragsvorlage hinterlegt ist (oder ohne Bearbeitungsrecht).
 */
export function AuftragDocumentButton({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  const hasTemplate = useHasAuftragDocumentTemplate(enabled).data ?? false;
  if (!enabled || !hasTemplate) return null;

  return (
    <section className="border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Auftragsdokument</h3>
          <p className="text-[11px] text-muted-foreground">Auftrag als Word aus deiner Vorlage.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={`/api/projekte/${projectId}/auftrag-document`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileType className="size-4" aria-hidden />
            Als Word (Auftrag)
          </a>
          <a
            href={`/api/projekte/${projectId}/auftrag-document?format=pdf`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileType className="size-4" aria-hidden />
            Als PDF
          </a>
        </div>
      </div>
    </section>
  );
}
