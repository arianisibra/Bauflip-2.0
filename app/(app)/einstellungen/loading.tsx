import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function EinstellungenLoading() {
  return (
    <div className="flex min-h-[min(50vh,24rem)] items-center justify-center py-12">
      <BauflipLoading label="Einstellungen werden geladen …" size="md" />
    </div>
  );
}
