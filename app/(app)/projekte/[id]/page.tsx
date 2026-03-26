import { redirect } from "next/navigation";

type Params = {
  params: Promise<{ id: string }>;
};

export default async function ProjektDetailPage({ params }: Params) {
  const { id } = await params;
  redirect(`/projekte?openProjectId=${encodeURIComponent(id)}`);
}
