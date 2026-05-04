import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isMonteurMontageContext } from "@/lib/tech/monteur-context";
import { getProjectCore, listActiveOrderFormTemplatesForOrg, signAttachmentUrls } from "@/lib/db/repository";
import { BauflipLoading } from "@/components/ui/bauflip-loading";

const MonteurAuftragClient = dynamic(
  () => import("@/components/app/monteur-auftrag-client").then((m) => m.MonteurAuftragClient),
  {
    loading: () => (
      <div className="flex h-[50vh] min-h-[12rem] items-center justify-center" role="status" aria-live="polite">
        <BauflipLoading size="sm" label="Auftrag wird geladen …" />
      </div>
    ),
  },
);

type Params = { params: Promise<{ projectId: string }> };

export default async function MonteurAuftragPage({ params }: Params) {
  const [session, { projectId }] = await Promise.all([getCurrentSession(), params]);
  if (!session) redirect("/anmeldung");
  const core = await getProjectCore(projectId);
  if (!core) {
    notFound();
  }

  if (session.role === "technician") {
    const isAssigned =
      core.appointments.some((a) => a.assignedTechnicianId === session.user.id) ||
      core.project.nextOwnerUserId === session.user.id;
    if (!isAssigned) {
      notFound();
    }
  } else if (session.role === "admin" || session.role === "office") {
    const orgId = core.project.organizationId;
    if (
      !session.organizationId ||
      !orgId ||
      session.organizationId !== orgId
    ) {
      notFound();
    }
  } else {
    redirect("/");
  }

  const skipOrderFormTemplates = isMonteurMontageContext(
    core.project.status,
    core.reports.length,
  );

  const [orderFormTemplates, signedAttachments] = await Promise.all([
    !skipOrderFormTemplates && core.project.organizationId != null
      ? listActiveOrderFormTemplatesForOrg(core.project.organizationId)
      : Promise.resolve([]),
    signAttachmentUrls(core.attachments),
  ]);

  const coreWithSignedUrls = { ...core, attachments: signedAttachments };

  return (
    <MonteurAuftragClient
      core={coreWithSignedUrls}
      orderFormTemplates={orderFormTemplates}
      viewerRole={session.role}
      currentUserId={session.user.id}
    />
  );
}
