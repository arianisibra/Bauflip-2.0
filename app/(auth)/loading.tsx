import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gradient-to-b from-background to-accent/20 px-6 py-16">
      <BauflipLoading label="Wird geladen …" size="md" />
    </div>
  );
}
