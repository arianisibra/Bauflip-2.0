import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant="outline" className={cn(projectStatusBadgeClassName(status))}>
      {projectStatusLabels[status]}
    </Badge>
  );
}
