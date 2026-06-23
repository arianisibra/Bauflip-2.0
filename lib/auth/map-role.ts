import type { RoleType } from "@/lib/domain/types";

export function mapRole(raw: string | null | undefined): RoleType {
  if (raw === "admin" || raw === "office" || raw === "technician") {
    return raw;
  }
  if (raw === "monteur") {
    return "technician";
  }
  return "office";
}
