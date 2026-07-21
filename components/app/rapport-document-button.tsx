"use client";

import { FileType } from "lucide-react";
import { useHasRapportDocumentTemplate } from "@/lib/query/hooks";
import { buttonVariants } from "@/components/ui/button";

/**
 * «Als Word (Rapport)» — lädt einen Rapport aus der Org-Vorlage als .docx.
 * Rendert nichts, wenn keine Rapportvorlage hinterlegt ist. Sitzt in der
 * Aktionsleiste einer aufgeklappten Rapport-Karte.
 */
export function RapportDocumentButton({ reportId }: { reportId: string }) {
  const hasTemplate = useHasRapportDocumentTemplate().data ?? false;
  if (!hasTemplate) return null;

  return (
    <a
      href={`/api/rapporte/${reportId}/document`}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5 text-xs"}
    >
      <FileType className="size-3.5" aria-hidden />
      Als Word (Vorlage)
    </a>
  );
}
