"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MapPin, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { getErrorMessage } from "@/lib/errors/friendly-message";
import { useWerkstattFertig, useWerkstattProjekte } from "@/lib/query/hooks";

function seitText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `seit ${d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" })}`;
}

export function WerkstattListe() {
  const { data: projekte, isPending, isError, error, refetch } = useWerkstattProjekte();
  const fertig = useWerkstattFertig();
  // Zweistufig statt Browser-Dialog: auf dem Tablet gut treffbar, kein versehentlicher Wechsel.
  const [bestaetigen, setBestaetigen] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="flex justify-center py-12" role="status" aria-live="polite">
        <BauflipLoading label="Werkstatt wird geladen …" size="md" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6 text-sm">
          <p>{getErrorMessage(error, "Werkstatt konnte nicht geladen werden.")}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (projekte.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <Wrench className="size-6" aria-hidden />
          Zurzeit ist nichts in der Werkstatt.
        </CardContent>
      </Card>
    );
  }

  const melden = async (id: string) => {
    try {
      await fertig.mutateAsync(id);
      setBestaetigen(null);
      toast.success("Werkstatt fertig — Auftrag ist jetzt montagebereit");
    } catch (e) {
      setBestaetigen(null);
      toast.error(getErrorMessage(e, "Konnte nicht gespeichert werden."));
    }
  };

  return (
    <ul className="flex flex-col gap-3">
      {projekte.map((p) => {
        const laeuft = fertig.isPending && fertig.variables === p.id;
        return (
          <li key={p.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {p.title || "Ohne Titel"}
                    {p.referenz ? <span className="ml-2 text-xs font-normal text-muted-foreground">{p.referenz}</span> : null}
                  </p>
                  {p.adresse ? (
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {p.adresse}
                    </p>
                  ) : null}
                  {p.info ? <p className="mt-2 whitespace-pre-line text-sm">{p.info}</p> : null}
                  {p.hinweise ? (
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.hinweise}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">{seitText(p.seit)}</p>
                </div>
                {bestaetigen === p.id ? (
                  <div className="flex gap-2">
                    <Button className="h-11 flex-1" onClick={() => void melden(p.id)} disabled={fertig.isPending}>
                      {laeuft ? <BauflipLoadingButtonLabel>Speichert …</BauflipLoadingButtonLabel> : "Ja, fertig"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => setBestaetigen(null)}
                      disabled={fertig.isPending}
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 border-orange-500/40 text-orange-700 dark:text-orange-200"
                    onClick={() => setBestaetigen(p.id)}
                    disabled={fertig.isPending}
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    WERKSTATT FERTIG
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
