"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { getApprovedRevenueSeries, saveDashboardLayout } from "@/lib/db/repository";
import { sanitizeLayoutForRole } from "@/lib/dashboard/sanitize";
import { dashboardLayoutSchema } from "@/lib/dashboard/types";
import type { ApprovedRevenueSeries } from "@/lib/domain/types";

function parseDateOnlyLocal(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) {
    return new Date(NaN);
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export async function getRevenueSeriesAction(fromIso: string, toIso: string): Promise<ApprovedRevenueSeries> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const from = parseDateOnlyLocal(fromIso);
  const to = parseDateOnlyLocal(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Ungültiger Zeitraum.");
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  if (from > to) {
    throw new Error("Der Start muss vor dem Ende liegen.");
  }
  const maxDays = 800;
  if ((to.getTime() - from.getTime()) / 86400000 > maxDays) {
    throw new Error("Zeitraum maximal 24 Monate.");
  }
  return getApprovedRevenueSeries(from, to);
}

export async function saveDashboardLayoutAction(layout: unknown) {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Nicht angemeldet.");
  }
  const parsed = dashboardLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    throw new Error("Ungültiges Dashboard-Layout.");
  }
  const cleaned = sanitizeLayoutForRole(parsed.data, session.role);
  await saveDashboardLayout(session.user.id, cleaned);
  revalidatePath("/");
}
