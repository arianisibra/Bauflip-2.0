import Link from "next/link";
import { listArticleCategories } from "@/lib/db/repository";
import { buttonVariants } from "@/components/ui/button-variants";
import { ArtikelEditor } from "../artikel-editor";

export default async function ArtikelNeuPage() {
  const categories = await listArticleCategories();
  if (categories.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Keine Produktkategorien vorhanden. Bitte legen Sie zuerst eine Kategorie an.</p>
        <Link href="/artikel" className={buttonVariants({ variant: "outline" })}>
          Zurück zu Artikel
        </Link>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Neuer Artikel</h1>
        <Link href="/artikel" className={buttonVariants({ variant: "outline" })}>
          Zurück
        </Link>
      </div>
      <ArtikelEditor article={null} categories={categories} />
    </section>
  );
}
