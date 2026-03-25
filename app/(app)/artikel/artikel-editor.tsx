import type { Article, ArticleCategory, ArticleCategoryTemplateScope } from "@/lib/domain/types";
import { ARTICLE_PLACEHOLDER_EXAMPLE_LAMELLEN, ARTICLE_TEXT_PLACEHOLDERS } from "@/lib/domain/article-placeholders";
import { ArticleCategorySelect } from "@/components/app/article-category-select";
import { ArticleTemplateScopeSelect } from "@/components/app/article-template-scope-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createArticleCategoryAction, saveArticleAction } from "./actions";

const templateScopeLabel: Record<ArticleCategoryTemplateScope, string> = {
  generic: "Allgemein",
  storen: "Storen",
  sonnenstoren: "Sonnenstoren",
  dl: "Dienstleistung",
};

function scopeHint(scope: ArticleCategoryTemplateScope): string {
  switch (scope) {
    case "storen":
      return "Platzhalter z. B. Breite, Höhe, Bedienung, Stoff, Rahmen.";
    case "sonnenstoren":
      return "Zusätzlich z. B. Ausladung.";
    case "dl":
      return "Datum-Platzhalter in Beschreibungen.";
    default:
      return "Basis-Platzhalter (Bezeichnung, Ort).";
  }
}

type Props = {
  article: Article | null;
  categories: ArticleCategory[];
};

export function ArtikelEditor({ article, categories }: Props) {
  const selected = article
    ? categories.find((c) => c.id === article.categoryId)
    : categories[0];
  const scope = selected?.templateScope ?? "generic";

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <form action={saveArticleAction} className="flex flex-col gap-6">
        {article ? <input type="hidden" name="id" value={article.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="name">Bezeichnung</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={article?.name ?? ""}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sku">Artikelnummer (intern)</Label>
            <Input id="sku" name="sku" required defaultValue={article?.sku ?? ""} autoComplete="off" />
          </div>
          <ArticleCategorySelect
            categories={categories}
            defaultCategoryId={article?.categoryId ?? categories[0]?.id ?? ""}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchasePrice">Einkaufspreis</Label>
            <Input
              id="purchasePrice"
              name="purchasePrice"
              type="text"
              inputMode="decimal"
              placeholder="z. B. 42.50"
              defaultValue={article?.purchasePrice != null ? String(article.purchasePrice) : ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="salePrice">Verkaufspreis</Label>
            <Input
              id="salePrice"
              name="salePrice"
              type="text"
              inputMode="decimal"
              placeholder="z. B. 89.00"
              defaultValue={article?.salePrice != null ? String(article.salePrice) : ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit">Einheit</Label>
            <Input
              id="unit"
              name="unit"
              required
              placeholder="Stk, m, m² …"
              defaultValue={article?.unit ?? "Stk"}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="inStock">Lagerbestand</Label>
            <Input
              id="inStock"
              name="inStock"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={article?.inStock ?? 0}
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="supplierId">Lieferant (optional)</Label>
            <Input
              id="supplierId"
              name="supplierId"
              defaultValue={article?.supplierId ?? ""}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionShort">Kurzbeschreibung</Label>
          <Textarea
            id="descriptionShort"
            name="descriptionShort"
            rows={3}
            placeholder="Kurztext für Listen, mit Platzhaltern wie xxxBEZEICHNUNGxxx …"
            defaultValue={article?.descriptionShort ?? ""}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="descriptionLong">Artikelbeschreibung</Label>
          <Textarea
            id="descriptionLong"
            name="descriptionLong"
            rows={8}
            placeholder="Ausführliche Beschreibung mit Textbausteinen …"
            defaultValue={article?.descriptionLong ?? ""}
          />
        </div>

        <details className="rounded-lg border bg-muted/30 p-4 text-sm">
          <summary className="cursor-pointer font-medium">Textplatzhalter in Kurz- und Langbeschreibung</summary>
          <p className="mt-2 text-muted-foreground">
            {ARTICLE_PLACEHOLDER_EXAMPLE_LAMELLEN} Aktuelle Kategorie-Vorlage:{" "}
            <span className="text-foreground">{templateScopeLabel[scope]}</span> — {scopeHint(scope)}
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground">
            {ARTICLE_TEXT_PLACEHOLDERS.map((p) => (
              <li key={p.token}>
                <code className="rounded bg-background px-1 py-0.5 text-xs">{p.token}</code> — {p.label}
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">{article ? "Speichern" : "Artikel anlegen"}</Button>
        </div>
      </form>

      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Neue Produktkategorie</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kategorien erscheinen im Dropdown. Die Vorlage steuert Hinweise zu den Textplatzhaltern (Storen, Sonnenstoren,
          Dienstleistung).
        </p>
        <form action={createArticleCategoryAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label htmlFor="newCatName">Name</Label>
            <Input id="newCatName" name="name" required placeholder="z. B. Lamellenstoren" autoComplete="off" />
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:w-56">
            <Label htmlFor="templateScope">Vorlage</Label>
            <ArticleTemplateScopeSelect />
          </div>
          <Button type="submit" variant="secondary">
            Kategorie anlegen
          </Button>
        </form>
      </section>
    </div>
  );
}
