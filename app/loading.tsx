import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function RootLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-background px-6 py-16">
      <BauflipLoading label="Wird geladen …" size="md" />
    </div>
  );
}
