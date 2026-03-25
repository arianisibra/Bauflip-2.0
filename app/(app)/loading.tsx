import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function AppLoading() {
  return (
    <div className="flex min-h-[min(60vh,28rem)] items-center justify-center py-16">
      <BauflipLoading label="Wird geladen …" size="md" />
    </div>
  );
}
