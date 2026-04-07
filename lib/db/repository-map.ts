import type { RoleType, UserProfile } from "@/lib/domain/types";

function isRoleType(v: unknown): v is RoleType {
  return v === "admin" || v === "office" || v === "technician";
}

export function mapUserProfileRow(row: Record<string, unknown>, emailFallback = ""): UserProfile {
  const r = row.role;
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? row.displayName ?? ""),
    email: String(row.email ?? emailFallback),
    role: isRoleType(r) ? r : "office",
    avatarUrl: row.avatar_url != null ? String(row.avatar_url) : row.avatarUrl != null ? String(row.avatarUrl) : null,
    calendarColor: row.calendar_color != null ? String(row.calendar_color) : null,
    calendarPosition: Number(row.calendar_position ?? row.calendarPosition ?? 0),
  };
}
