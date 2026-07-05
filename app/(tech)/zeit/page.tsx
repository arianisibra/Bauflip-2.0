import { TimeEntriesManager } from "@/components/app/time-entries-manager";

export default function TechZeitPage() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Zeiterfassung</h1>
        <p className="text-sm text-muted-foreground">Deine erfasste Arbeitszeit.</p>
      </div>
      <TimeEntriesManager />
    </div>
  );
}
