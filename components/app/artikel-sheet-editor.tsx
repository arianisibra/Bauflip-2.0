"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { getArticleSheetDataAction, saveArticleSheetAction } from "@/app/(app)/artikel/actions";
import { articleSaveSchema } from "@/lib/validations/forms";
import type { ArticleCategory, ArticleCategoryTemplateScope } from "@/lib/domain/types";
import { ARTICLE_PLACEHOLDER_EXAMPLE_LAMELLEN, ARTICLE_TEXT_PLACEHOLDERS } from "@/lib/domain/article-placeholders";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";

type FormValues = z.infer<typeof articleSaveSchema>;

const templateScopeLabel: Record<ArticleCategoryTemplateScope, string> = {
  generic: "Allgemein",
  storen: "Storen",
  sonnenstoren: "Sonnenstoren",
  dl: "Dienstleistung",
};

function articleToForm(a: NonNullable<Awaited<ReturnType<typeof getArticleSheetDataAction>>["article"]>): FormValues {
  return {
    id: a.id,
    name: a.name,
    sku: a.sku,
    bexioArticleId: a.bexioArticleId ?? "",
    categoryId: a.categoryId,
    supplierId: a.supplierId ?? "",
    purchasePrice: a.purchasePrice != null ? String(a.purchasePrice) : "",
    salePrice: a.salePrice != null ? String(a.salePrice) : "",
    unit: a.unit,
    descriptionShort: a.descriptionShort ?? "",
    descriptionLong: a.descriptionLong ?? "",
    inStock: a.inStock,
  };
}

type Props = {
  articleId: string | null;
  open: boolean;
  canEdit: boolean;
};

export function ArtikelSheetEditor({ articleId, open, canEdit }: Props) {
  const router = useRouter();
  const [loadPending, startLoad] = useTransition();
  const [savePending, startSave] = useTransition();
  const [bundleReady, setBundleReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [scopeHint, setScopeHint] = useState<ArticleCategoryTemplateScope>("generic");

  const form = useForm<FormValues>({
    resolver: zodResolver(articleSaveSchema),
  });

  const categoryId = form.watch("categoryId");

  useEffect(() => {
    const c = categories.find((x) => x.id === categoryId);
    if (c) {
      setScopeHint(c.templateScope);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (!open || !articleId) {
      setBundleReady(false);
      setCategories([]);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    setBundleReady(false);
    startLoad(async () => {
      try {
        const data = await getArticleSheetDataAction(articleId);
        if (cancelled) {
          return;
        }
        setCategories(data.categories);
        form.reset(articleToForm(data.article));
        const cat = data.categories.find((x) => x.id === data.article.categoryId);
        setScopeHint(cat?.templateScope ?? "generic");
        setBundleReady(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Laden fehlgeschlagen.");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, articleId, form]);

  const onSubmit = form.handleSubmit((values) => {
    setSaveError(null);
    startSave(async () => {
      try {
        await saveArticleSheetAction(values);
        if (articleId) {
          const fresh = await getArticleSheetDataAction(articleId);
          setCategories(fresh.categories);
          form.reset(articleToForm(fresh.article));
        }
        router.refresh();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  });

  if (!articleId) {
    return null;
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  if ((loadPending || !bundleReady) && !loadError) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center py-6">
        <BauflipLoading label="Artikel wird geladen …" size="sm" />
      </div>
    );
  }

  const ro = !canEdit;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <input type="hidden" {...form.register("id")} />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stammdaten</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="as-name" className="text-sm">
              Bezeichnung
            </Label>
            <Input id="as-name" className="h-9" disabled={ro} {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-sku" className="text-sm">
              Artikelnummer
            </Label>
            <Input id="as-sku" className="h-9" disabled={ro} {...form.register("sku")} />
            {form.formState.errors.sku ? (
              <p className="text-sm text-destructive">{form.formState.errors.sku.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="as-bexio-art" className="text-sm">
              bexio Artikel-ID (optional)
            </Label>
            <Input
              id="as-bexio-art"
              className="h-9"
              disabled={ro}
              placeholder="z. B. 12345 für Zapier / article_ids"
              {...form.register("bexioArticleId")}
            />
            {form.formState.errors.bexioArticleId ? (
              <p className="text-sm text-destructive">{form.formState.errors.bexioArticleId.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-cat" className="text-sm">
              Produktkategorie
            </Label>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(String(v))}
                  disabled={ro}
                >
                  <SelectTrigger id="as-cat" className="h-9 w-full min-w-0">
                    <SelectValue
                      resolvedLabel={field.value ? (categories.find((c) => c.id === field.value)?.name ?? "") : ""}
                      placeholder="Kategorie wählen"
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="as-supplier" className="text-sm">
              Lieferant (optional, ID)
            </Label>
            <Input id="as-supplier" className="h-9" disabled={ro} {...form.register("supplierId")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-ek" className="text-sm">
              Einkaufspreis
            </Label>
            <Input
              id="as-ek"
              className="h-9"
              disabled={ro}
              inputMode="decimal"
              placeholder="z. B. 42.50"
              {...form.register("purchasePrice")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-vk" className="text-sm">
              Verkaufspreis
            </Label>
            <Input
              id="as-vk"
              className="h-9"
              disabled={ro}
              inputMode="decimal"
              placeholder="z. B. 89.00"
              {...form.register("salePrice")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-unit" className="text-sm">
              Einheit
            </Label>
            <Input id="as-unit" className="h-9" disabled={ro} placeholder="Stk, m, m² …" {...form.register("unit")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-stock" className="text-sm">
              Lagermenge
            </Label>
            <Input
              id="as-stock"
              type="number"
              min={0}
              step={1}
              className="h-9"
              disabled={ro}
              {...form.register("inStock", { valueAsNumber: true })}
            />
            {form.formState.errors.inStock ? (
              <p className="text-sm text-destructive">{form.formState.errors.inStock.message}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texte</h3>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-short" className="text-sm">
              Kurzbeschreibung
            </Label>
            <Textarea id="as-short" className="min-h-[5rem] text-sm" disabled={ro} {...form.register("descriptionShort")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="as-long" className="text-sm">
              Artikelbeschreibung
            </Label>
            <Textarea id="as-long" className="min-h-[9rem] text-sm" disabled={ro} {...form.register("descriptionLong")} />
          </div>
        </div>

        <details className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">Textplatzhalter</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {ARTICLE_PLACEHOLDER_EXAMPLE_LAMELLEN} Vorlage:{" "}
            <span className="text-foreground">{templateScopeLabel[scopeHint]}</span>
          </p>
          <ul className="mt-2 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
            {ARTICLE_TEXT_PLACEHOLDERS.map((p) => (
              <li key={p.token}>
                <code className="rounded bg-background px-1 py-0.5 text-[0.65rem]">{p.token}</code> — {p.label}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}

      {ro ? (
        <p className="text-sm text-muted-foreground">Nur Büro und Admin können Artikel bearbeiten.</p>
      ) : (
        <div className="sticky bottom-0 -mx-1 border-t border-border/60 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="submit" className="w-full" disabled={savePending}>
            {savePending ? (
              <BauflipLoadingButtonLabel variant="onPrimary">Speichern …</BauflipLoadingButtonLabel>
            ) : (
              "Änderungen speichern"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
