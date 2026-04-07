import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function TechLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center py-12">
      <BauflipLoading label="Wird geladen …" size="md" />
    </div>
  );
}
