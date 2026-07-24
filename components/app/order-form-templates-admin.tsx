"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useCreateOrderFormTemplate, useOrderFormTemplates } from "@/lib/query/hooks";
import { toast } from "sonner";
import type { OrderFormTemplate } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BauflipLoading, BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FilePlus2, FileText, MousePointerClick } from "lucide-react";

const CmsFormEditor = dynamic(
  () => import("@/components/app/order-form-cms-editor").then((m) => m.CmsFormEditor),
  {
    loading: () => (
      <div className="flex min-h-[min(60vh,480px)] items-center justify-center rounded-xl border border-border/60 bg-muted/10 p-8">
        <BauflipLoading size="sm" label="Editor wird geladen …" />
      </div>
    ),
  },
);

export function OrderFormTemplatesAdmin({ templates: initialTemplates }: { templates: OrderFormTemplate[] }) {
  const { data: templates = initialTemplates } = useOrderFormTemplates(initialTemplates);
  const createTpl = useCreateOrderFormTemplate();
  const createPending = createTpl.isPending;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState("");
  const [newFormName, setNewFormName] = useState("");

  const supplierSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates) {
      const v = t.supplierName?.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "de-CH"));
  }, [templates]);

  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined;

  const handleCreate = async () => {
    setCreateError(null);
    const name = newFormName.trim();
    if (name.length < 2) {
      setCreateError("Bitte Formularname angeben (min. 2 Zeichen).");
      return;
    }
    try {
      const { id } = await createTpl.mutateAsync({
        supplierName: newSupplier,
        name,
        sortOrder: 0,
        isActive: true,
        fields: [],
      });
      setNewFormName("");
      setNewSupplier("");
      setSelectedId(id);
      toast.success("Formular erstellt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-20 lg:max-w-xs">
        <Card size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FilePlus2 className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Neues Formular</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Lieferant und Name eingeben.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="cms-new-supplier" className="text-xs font-medium">
                Lieferantenname
              </Label>
              <Input
                id="cms-new-supplier"
                list="cms-supplier-datalist"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
                placeholder="Aus Liste oder frei eingeben"
              />
              <datalist id="cms-supplier-datalist">
                {supplierSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cms-new-name" className="text-xs font-medium">
                Formularname
              </Label>
              <Input
                id="cms-new-name"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="z. B. Standardauftrag"
              />
            </div>
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-card px-3 py-3">
            <Button type="button" className="w-full" size="sm" onClick={handleCreate} disabled={createPending}>
              {createPending ? (
                <BauflipLoadingButtonLabel variant="onPrimary">Wird erstellt …</BauflipLoadingButtonLabel>
              ) : (
                "Formular erstellen"
              )}
            </Button>
          </CardFooter>
          {createError ? (
            <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {createError}
            </div>
          ) : null}
        </Card>

        <Card size="sm" className="overflow-hidden border-border/60 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-muted/25 pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">Formulare</CardTitle>
            <CardAction>
              <Badge variant="secondary">{templates.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            <ul className="max-h-[min(50vh,420px)] divide-y divide-border/40 overflow-y-auto">
              {templates.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Noch keine Formulare vorhanden.
                </li>
              ) : (
                templates.map((t) => {
                  const active = selectedId === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                          active
                            ? "bg-primary/8 ring-1 ring-inset ring-primary/25"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground ring-1 ring-border/60">
                          <FileText className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm",
                              active ? "font-medium text-foreground" : "text-foreground",
                            )}
                          >
                            {t.name}
                          </p>
                          {t.supplierName?.trim() ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {t.supplierName.trim()}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                          {t.isActive ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            >
                              aktiv
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                            >
                              inaktiv
                            </Badge>
                          )}
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {t.fields?.length ?? 0} Felder
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </CardContent>
          <CardFooter className="py-2.5">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Aktive Vorlagen erscheinen im Monteur-Rapport.
            </p>
          </CardFooter>
        </Card>
      </aside>

      <main className="min-w-0 flex-1">
        {selected ? (
          <CmsFormEditor key={selected.id} template={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex min-h-[min(60vh,480px)] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-gradient-to-br from-muted/10 to-muted/5 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground">
              <MousePointerClick className="size-7" />
            </div>
            <div className="max-w-md space-y-1">
              <p className="text-sm font-medium text-foreground">Kein Formular ausgewählt</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wählen Sie links ein bestehendes Formular aus oder legen Sie ein neues an.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
