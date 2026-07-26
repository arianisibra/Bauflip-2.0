"use client";

import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { useIntakeEmailSettings, useRegenerateIntakeEmailToken } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { SettingsRow } from "@/components/app/settings-row";

/**
 * E-Mail-Intake (Einstellungen, Admin): zeigt die dedizierte Intake-Adresse
 * der Org — eingehende E-Mails daran legen automatisch einen Projektentwurf
 * an (source «email»), inkl. KI-Extraktion von Name/Adresse/Problem falls
 * ANTHROPIC_API_KEY gesetzt ist. Ohne INTAKE_EMAIL_DOMAIN ist die Funktion
 * inaktiv (analog SMTP für den Versand).
 */
export function IntakeEmailSettingsCard() {
  const settingsQuery = useIntakeEmailSettings();
  const regenerate = useRegenerateIntakeEmailToken();
  const settings = settingsQuery.data;

  const copyAddress = async () => {
    if (!settings?.address) return;
    try {
      await navigator.clipboard.writeText(settings.address);
      toast.success("Adresse kopiert");
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Neue Intake-Adresse erzeugen? Die bisherige Adresse funktioniert danach nicht mehr.")) return;
    try {
      await regenerate.mutateAsync();
      toast.success("Neue Intake-Adresse erzeugt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehlgeschlagen.");
    }
  };

  const summary = settingsQuery.isLoading
    ? "Wird geladen …"
    : settings?.address
      ? settings.address
      : "Noch nicht eingerichtet — INTAKE_EMAIL_DOMAIN fehlt.";

  return (
    <SettingsRow
      title="E-Mail-Intake"
      summary={summary}
      action={
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={!settings?.address} onClick={copyAddress}>
            <Copy className="size-4" aria-hidden />
            Kopieren
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={regenerate.isPending || settingsQuery.isLoading}
            onClick={handleRegenerate}
          >
            <RefreshCw className="size-4" aria-hidden />
          </Button>
        </div>
      }
    />
  );
}
