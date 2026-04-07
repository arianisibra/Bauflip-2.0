import { notFound } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getProjectCore, listActiveOrderFormTemplatesForOrg } from "@/lib/db/repository";
import { MonteurAuftragClient } from "@/components/app/monteur-auftrag-client";

type Params = { params: Promise<{ projectId: string }> };

export default async function MonteurAuftragPage({ params }: Params) {
  const session = await getCurrentSession();
  if (!session || session.role !== "technician") {
    return null;
  }

  const { projectId } = await params;
  const core = await getProjectCore(projectId);
  if (!core) {
    notFound();
  }

  const isAssigned =
    core.appointments.some((a) => a.assignedTechnicianId === session.user.id) ||
    core.project.nextOwnerUserId === session.user.id;

  if (!isAssigned) {
    notFound();
  }

  const orderFormTemplates =
    core.project.organizationId != null
      ? await listActiveOrderFormTemplatesForOrg(core.project.organizationId)
      : [];

  return <MonteurAuftragClient core={core} orderFormTemplates={orderFormTemplates} />;
}
