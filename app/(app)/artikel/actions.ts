"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteArticle, getArticleById, insertArticleCategory, listArticleCategories, saveArticle } from "@/lib/db/repository";
import { articleCategoryCreateSchema, articleSaveSchema } from "@/lib/validations/forms";

function parseOptPrice(raw: string | undefined): number | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function getArticleSheetDataAction(articleId: string) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const article = await getArticleById(articleId);
  if (!article) {
    throw new Error("Artikel nicht gefunden.");
  }
  const categories = await listArticleCategories();
  return { article, categories };
}

export async function saveArticleSheetAction(values: unknown) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  const parsed = articleSaveSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  const id = v.id?.trim();
  if (!id) {
    throw new Error("Artikel-ID fehlt.");
  }
  await saveArticle({
    id,
    name: v.name.trim(),
    sku: v.sku.trim(),
    bexioArticleId: v.bexioArticleId?.trim() || null,
    categoryId: v.categoryId,
    supplierId: v.supplierId?.trim() || null,
    purchasePrice: parseOptPrice(v.purchasePrice),
    salePrice: parseOptPrice(v.salePrice),
    unit: v.unit.trim(),
    descriptionLong: v.descriptionLong?.trim() || null,
    descriptionShort: v.descriptionShort?.trim() || null,
    inStock: v.inStock,
  });
  revalidatePath("/artikel");
  revalidatePath(`/artikel/${id}`);
}

export async function saveArticleAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = articleSaveSchema.safeParse({
    ...raw,
    inStock: raw.inStock,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  const v = parsed.data;
  const saved = await saveArticle({
    id: v.id?.trim() || undefined,
    name: v.name.trim(),
    sku: v.sku.trim(),
    bexioArticleId: v.bexioArticleId?.trim() || null,
    categoryId: v.categoryId,
    supplierId: v.supplierId?.trim() || null,
    purchasePrice: parseOptPrice(v.purchasePrice),
    salePrice: parseOptPrice(v.salePrice),
    unit: v.unit.trim(),
    descriptionLong: v.descriptionLong?.trim() || null,
    descriptionShort: v.descriptionShort?.trim() || null,
    inStock: v.inStock,
  });
  revalidatePath("/artikel");
  revalidatePath(`/artikel/${saved.id}`);
  redirect(`/artikel/${saved.id}`);
}

export async function createArticleCategoryAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = articleCategoryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  }
  await insertArticleCategory({
    name: parsed.data.name.trim(),
    templateScope: parsed.data.templateScope,
  });
  revalidatePath("/artikel", "layout");
}

export async function deleteArticleAction(articleId: string) {
  const session = await getCurrentSession();
  if (!session || (session.role !== "office" && session.role !== "admin")) {
    throw new Error("Keine Berechtigung.");
  }
  if (!articleId?.trim()) {
    throw new Error("Artikel-ID fehlt.");
  }
  await deleteArticle(articleId.trim());
  revalidatePath("/artikel");
}
