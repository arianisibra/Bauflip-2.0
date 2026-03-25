"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArticleCategory } from "@/lib/domain/types";

type Props = {
  categories: ArticleCategory[];
  defaultCategoryId: string;
};

export function ArticleCategorySelect({ categories, defaultCategoryId }: Props) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Label>Produktkategorie</Label>
        <p className="text-sm text-muted-foreground">Keine Kategorie vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="categoryId">Produktkategorie</Label>
      <input type="hidden" name="categoryId" value={categoryId} readOnly />
      <Select value={categoryId} onValueChange={(v) => setCategoryId(String(v))}>
        <SelectTrigger id="categoryId" className="h-9 w-full min-w-0">
          <SelectValue
            resolvedLabel={categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? "") : ""}
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
    </div>
  );
}
