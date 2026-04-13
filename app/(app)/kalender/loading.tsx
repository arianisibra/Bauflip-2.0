import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function KalenderLoading() {
  return (
    <div className="flex min-h-[min(50vh,24rem)] items-center justify-center py-12">
      <BauflipLoading label="Kalender wird geladen …" size="md" />
    </div>
  );
}
