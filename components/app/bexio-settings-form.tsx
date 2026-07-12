"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  useBexioMappingOptions,
  useBexioSettings,
  useConnectBexio,
  useDisconnectBexio,
  useSaveBexioMapping,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Konten mit Ertragskonto-Typ (account_type) — Bexio-Konvention, siehe docs/PLAN-zahlungen-bexio.md. */
const REVENUE_ACCOUNT_TYPE = 3;

/** Bexio-Anbindung (Teil B, Modell A): Token verbinden, MwSt-/Konto-Mapping. Push folgt in B3. */
export function BexioSettingsForm() {
  const settingsQuery = useBexioSettings();
  const connect = useConnectBexio();
  const disconnect = useDisconnectBexio();
  const [token, setToken] = useState("");

  const settings = settingsQuery.data;
  const mappingOptions = useBexioMappingOptions(Boolean(settings?.connected));
  const saveMapping = useSaveBexioMapping();

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error("Bitte einen Bexio-API-Token eingeben.");
      return;
    }
    try {
      await connect.mutateAsync(token);
      setToken("");
      toast.success("Mit Bexio verbunden.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verbindung fehlgeschlagen.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success("Bexio-Verbindung getrennt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trennen fehlgeschlagen.");
    }
  };

  const handleMappingChange = async (field: "taxId" | "accountId", value: string) => {
    if (!settings) return;
    const numericValue = Number(value);
    try {
      await saveMapping.mutateAsync({
        taxId: field === "taxId" ? numericValue : settings.taxId,
        accountId: field === "accountId" ? numericValue : settings.accountId,
      });
      toast.success("Mapping gespeichert.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const revenueAccounts = (mappingOptions.data?.accounts ?? []).filter(
    (a) => a.account_type === REVENUE_ACCOUNT_TYPE && a.is_active,
  );
  const activeTaxes = (mappingOptions.data?.taxes ?? []).filter((t) => t.is_active);

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Bexio</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Persönlicher API-Token aus dem Bexio-Konto. Fertige Rechnungen werden nach dem Versand
          als Beleg zu Bexio übertragen (Bauflip bleibt Rechnungssteller). Der Token wird geprüft,
          bevor er gespeichert wird, und ist danach nie mehr sichtbar.
        </p>
      </div>

      {settingsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Wird geladen …</p>
      ) : settings?.connected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Verbunden
              {settings.connectedAt ? (
                <span className="text-muted-foreground">
                  seit {new Date(settings.connectedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disconnect.isPending}
              onClick={handleDisconnect}
            >
              {disconnect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Verbindung trennen
            </Button>
          </div>

          <div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Steuersatz und Ertragskonto für die Rechnungspositionen im Bexio-Beleg.
            </p>
            {mappingOptions.isLoading ? (
              <p className="text-sm text-muted-foreground">Bexio-Daten werden geladen …</p>
            ) : mappingOptions.isError ? (
              <p className="text-sm text-destructive">
                {mappingOptions.error instanceof Error
                  ? mappingOptions.error.message
                  : "Konten/Steuersätze konnten nicht geladen werden."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px]">Steuersatz</Label>
                  <Select
                    value={settings.taxId != null ? String(settings.taxId) : undefined}
                    onValueChange={(v) => handleMappingChange("taxId", String(v))}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue placeholder="Wählen …" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTaxes.map((tax) => (
                        <SelectItem key={tax.id} value={String(tax.id)}>
                          {tax.display_name || tax.name} ({tax.value}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Ertragskonto</Label>
                  <Select
                    value={settings.accountId != null ? String(settings.accountId) : undefined}
                    onValueChange={(v) => handleMappingChange("accountId", String(v))}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue placeholder="Wählen …" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.account_no} — {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-[11px]">API-Token</Label>
            <Input
              type="password"
              value={token}
              placeholder="Bexio Personal Access Token"
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="button" disabled={connect.isPending} onClick={handleConnect}>
            {connect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Verbinden
          </Button>
        </div>
      )}
    </section>
  );
}
