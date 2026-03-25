import { BauflipLoading } from "@/components/ui/bauflip-loading";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gradient-to-b from-slate-50 to-cyan-50/40 px-6 py-16">
      <BauflipLoading label="Wird geladen …" size="md" />
    </div>
  );
}
