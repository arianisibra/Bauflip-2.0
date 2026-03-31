"use client";

import { useRouter } from "next/navigation";
import { TechnicianReportForm } from "@/components/app/technician-report-form";

export function TechnicianRapportTech({ projectId }: { projectId: string }) {
  const router = useRouter();

  return (
    <TechnicianReportForm
      projectId={projectId}
      variant="fertigmeldung"
      submitLabel="Rapport abschließen"
      onSuccess={async () => {
        router.push("/tag");
        router.refresh();
      }}
    />
  );
}


