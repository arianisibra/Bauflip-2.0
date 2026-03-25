import { getCurrentSession } from "@/lib/auth/session";
import { listArticles } from "@/lib/db/repository";
import { ArtikelListClient } from "@/components/app/artikel-list-client";

export default async function ArtikelPage() {
  const session = await getCurrentSession();
  const articles = await listArticles();
  const canEditArticleSheet = session?.role === "office" || session?.role === "admin";

  return (
    <section className="flex flex-col gap-4">
      <ArtikelListClient articles={articles} canEditArticleSheet={canEditArticleSheet} />
    </section>
  );
}
