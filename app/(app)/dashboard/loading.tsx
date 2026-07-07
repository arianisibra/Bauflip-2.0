import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[min(50vh,24rem)] items-center justify-center py-12">
      <BauflipLoading label="Auswertungen werden geladen …" size="md" />
    </div>
  );
}
