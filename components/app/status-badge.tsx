import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/domain/types";
import { statusLabels } from "@/lib/workflow/project-workflow";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant="secondary">{statusLabels[status]}</Badge>;
}
