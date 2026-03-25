import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById, listArticleCategories } from "@/lib/db/repository";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArtikelEditor } from "../artikel-editor";

type Props = { params: Promise<{ id: string }> };

export default async function ArtikelDetailPage(props: Props) {
  const { id } = await props.params;
  const [article, categories] = await Promise.all([getArticleById(id), listArticleCategories()]);
  if (!article) {
    notFound();
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Artikel bearbeiten</h1>
        <Link href="/artikel" className={buttonVariants({ variant: "outline" })}>
          Zurück zur Liste
        </Link>
      </div>
      <ArtikelEditor article={article} categories={categories} />
    </section>
  );
}
