"use server";

import { requireOfficeSession } from "@/lib/auth/organization";
import { emptyDashboardData, type DashboardData } from "@/lib/db/dashboard";
import { fetchDashboardData } from "@/lib/dashboard/server-bootstrap";

export async function fetchDashboardDataAction(): Promise<DashboardData> {
  const session = await requireOfficeSession();
  if (!session.organizationId) return emptyDashboardData;
  return fetchDashboardData(session.organizationId);
}
