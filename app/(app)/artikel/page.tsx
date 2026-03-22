import { listArticles } from "@/lib/db/repository";

export default async function ArtikelPage() {
  const articles = await listArticles();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Artikel</h1>
      <p className="text-sm text-muted-foreground">
        Produktbereinigung angewendet: Markisen + Stoff, Faltrolladen Regapak.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {articles.map((article) => (
          <div key={article.id} className="rounded-lg border bg-white p-4">
            <p className="font-medium">{article.name}</p>
            <p className="text-sm text-muted-foreground">
              SKU: {article.sku} · Kategorie: {article.category}
            </p>
            <p className="text-sm text-muted-foreground">Lager: {article.inStock}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
