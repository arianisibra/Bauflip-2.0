"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Article } from "@/lib/domain/types";
import { ArtikelSheetEditor } from "@/components/app/artikel-sheet-editor";
import { buttonVariants } from "@/components/ui/button-variants";
import { ListPageToolbar } from "@/components/app/list-page-toolbar";
import { Sheet } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoney(n: number | null): string {
  if (n == null || Number.isNaN(n)) {
    return "—";
  }
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalize(s: string) {
  return s.toLowerCase().trim();
}

export function ArtikelListClient({
  articles,
  canEditArticleSheet,
}: {
  articles: Article[];
  canEditArticleSheet: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Article | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) {
      return articles;
    }
    const n = normalize(q);
    return articles.filter((a) => {
      return (
        normalize(a.name).includes(n) ||
        normalize(a.sku).includes(n) ||
        normalize(a.categoryName ?? "").includes(n) ||
        normalize(a.unit).includes(n) ||
        (a.descriptionShort && normalize(a.descriptionShort).includes(n))
      );
    });
  }, [articles, q]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold">Artikel</h1>
          <Link
            href="/import-export#artikel-import"
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            CSV Import / Export
          </Link>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <ListPageToolbar value={q} onChange={setQ} placeholder="Bezeichnung, Art.-Nr., Kategorie …" />
          <Link href="/artikel/neu" className={buttonVariants()}>
            Neuer Artikel
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table className="[&_tbody_tr:nth-child(even)]:bg-sky-50/40 dark:[&_tbody_tr:nth-child(even)]:bg-muted/25">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Art.-Nr.</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">EK</TableHead>
              <TableHead className="text-right">VK</TableHead>
              <TableHead>Einheit</TableHead>
              <TableHead>Kurzbeschreibung</TableHead>
              <TableHead className="text-right">Lager</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((article) => (
              <TableRow
                key={article.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelected(article);
                  setOpen(true);
                }}
              >
                <TableCell className="font-medium">{article.name}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{article.sku}</TableCell>
                <TableCell>{article.categoryName ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(article.purchasePrice)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(article.salePrice)}</TableCell>
                <TableCell>{article.unit}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={article.descriptionShort ?? ""}>
                  {article.descriptionShort ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{article.inStock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSelected(null);
          }
        }}
        className="max-w-xl"
        title={selected?.name ?? "Artikel"}
        description={selected ? `SKU: ${selected.sku} · ${selected.categoryName ?? "—"}` : undefined}
      >
        {selected ? (
          <ArtikelSheetEditor articleId={selected.id} open={open} canEdit={canEditArticleSheet} />
        ) : null}
      </Sheet>
    </>
  );
}
