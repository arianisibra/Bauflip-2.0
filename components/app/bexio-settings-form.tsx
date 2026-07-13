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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsRow } from "@/components/app/settings-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Konten mit Ertragskonto-Typ (account_type) — Bexio-Konvention, siehe docs/PLAN-zahlungen-bexio.md. */
const REVENUE_ACCOUNT_TYPE = 3;

/** Bexio-Anbindung (Teil B, Modell A): Zeile + Verwalten-Fenster (Verbinden, Mapping, Trennen). */
export function BexioSettingsForm() {
  const settingsQuery = useBexioSettings();
  const connect = useConnectBexio();
  const disconnect = useDisconnectBexio();
  const saveMapping = useSaveBexioMapping();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");

  const settings = settingsQuery.data;
  const mappingOptions = useBexioMappingOptions(open && Boolean(settings?.connected));

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

  const connected = Boolean(settings?.connected);
  const summary = settingsQuery.isLoading
    ? "Wird geladen …"
    : connected
      ? `Verbunden${settings?.connectedAt ? ` seit ${new Date(settings.connectedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}` : ""}`
      : "Nicht verbunden — Rechnungen werden nicht zu Bexio übertragen.";

  const footer = connected ? (
    <div className="flex items-center justify-between gap-2">
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        disabled={disconnect.isPending}
        onClick={handleDisconnect}
      >
        {disconnect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Verbindung trennen
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Schliessen
      </Button>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" disabled={connect.isPending} onClick={() => setOpen(false)}>
        Abbrechen
      </Button>
      <Button type="button" disabled={connect.isPending} onClick={handleConnect}>
        {connect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Verbinden
      </Button>
    </div>
  );

  return (
    <>
      <SettingsRow
        title="Bexio"
        summary={summary}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={settingsQuery.isLoading}
            onClick={() => setOpen(true)}
          >
            {connected ? "Verwalten" : "Verbinden"}
          </Button>
        }
      />

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Bexio"
        description="Fertige Rechnungen werden nach dem Versand als Beleg zu Bexio übertragen (Bauflip bleibt Rechnungssteller). Der Token wird geprüft, bevor er gespeichert wird, und ist danach nie mehr sichtbar."
        footer={footer}
      >
        {connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Verbunden
              {settings?.connectedAt ? (
                <span className="text-muted-foreground">
                  seit {new Date(settings.connectedAt).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
                </span>
              ) : null}
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
                      value={settings?.taxId != null ? String(settings.taxId) : undefined}
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
                      value={settings?.accountId != null ? String(settings.accountId) : undefined}
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
          <div>
            <Label className="text-[11px]">API-Token</Label>
            <Input
              type="password"
              value={token}
              placeholder="Bexio Personal Access Token"
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </Dialog>
    </>
  );
}
