import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/domain/types";
import { projectStatusLabels } from "@/lib/domain/types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant="secondary">{projectStatusLabels[status]}</Badge>;
}
