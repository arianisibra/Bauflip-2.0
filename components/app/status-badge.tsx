import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/lib/domain/types";
import { projectStatusBadgeClassName, projectStatusLabels } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * `label`/`className` überschreiben die hartcodierten Werte — Client-Aufrufer
 * lösen sie aus der Workflow-Config auf (Stufe B). Ohne Props: unverändert.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: ProjectStatus;
  label?: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(className ?? projectStatusBadgeClassName(status))}>
      {label ?? projectStatusLabels[status]}
    </Badge>
  );
}
