import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function KundenDetailRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/kontakte/${id}`);
}
