"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ProjectOrderLine } from "@/lib/domain/types";
import {
  useCreateProjectOrder,
  useDeleteProjectOrder,
  useProjectOrders,
  useSetProjectOrderReceived,
} from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BauflipLoading } from "@/components/ui/bauflip-loading";

/** Ab so vielen Tagen ohne Wareneingang wird eine offene Bestellung als «zu lange offen» markiert. */
const ORDER_OVERDUE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatSwissDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });
}

function daysSince(isoDate: string): number {
  const orderedMs = new Date(`${isoDate}T00:00:00`).getTime();
  return Math.floor((Date.now() - orderedMs) / MS_PER_DAY);
}

type FormState = { supplierName: string; description: string; orderedAt: string; expectedAt: string };

const EMPTY_FORM: FormState = { supplierName: "", description: "", orderedAt: todayIso(), expectedAt: "" };

function OrderLineRow({
  order,
  canEdit,
  onToggleReceived,
  onDelete,
  togglePending,
  deletePending,
}: {
  order: ProjectOrderLine;
  canEdit: boolean;
  onToggleReceived: () => void;
  onDelete: () => void;
  togglePending: boolean;
  deletePending: boolean;
}) {
  const isOpen = order.receivedAt == null;
  const days = daysSince(order.orderedAt);
  const isOverdue = isOpen && days >= ORDER_OVERDUE_DAYS;

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        isOverdue ? "border-orange-500/50 bg-orange-500/10" : "border-border/60 bg-muted/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{order.supplierName}</p>
          <p className="text-[13px] text-muted-foreground">{order.description}</p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant={isOpen ? "outline" : "ghost"}
              size="sm"
              disabled={togglePending}
              onClick={onToggleReceived}
            >
              {isOpen ? "Eingetroffen" : "Wieder öffnen"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={deletePending}
              onClick={onDelete}
            >
              Löschen
            </Button>
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Bestellt am {formatSwissDate(order.orderedAt)}</span>
        {order.expectedAt ? <span>Erwartet: {formatSwissDate(order.expectedAt)}</span> : null}
        {isOpen ? (
          <span className={isOverdue ? "font-semibold text-orange-700 dark:text-orange-300" : undefined}>
            {isOverdue
              ? `Seit ${days} Tagen offen — beim Lieferanten nachfragen?`
              : `Seit ${days} Tag${days === 1 ? "" : "en"} offen`}
          </span>
        ) : (
          <span>Eingetroffen{order.receivedAt ? ` am ${formatSwissDate(order.receivedAt.slice(0, 10))}` : ""}</span>
        )}
      </div>
    </li>
  );
}

/** Bestellungen je Projekt: mehrere Lieferanten-Zeilen mit «zu lange offen»-Markierung. */
export function OrderLinesSection({
  projectId,
  open,
  canEdit,
}: {
  projectId: string;
  open: boolean;
  canEdit: boolean;
}) {
  const ordersQuery = useProjectOrders(projectId, open);
  const createOrder = useCreateProjectOrder();
  const setReceived = useSetProjectOrderReceived();
  const deleteOrder = useDeleteProjectOrder();
  const [form, setForm] = useState<FormState | null>(null);

  const orders = ordersQuery.data ?? [];
  const openCount = orders.filter((o) => o.receivedAt == null).length;
  const overdueCount = orders.filter((o) => o.receivedAt == null && daysSince(o.orderedAt) >= ORDER_OVERDUE_DAYS).length;

  const submit = async () => {
    if (!form) return;
    if (!form.supplierName.trim() || !form.description.trim()) {
      toast.error("Bitte Lieferant und Beschreibung angeben.");
      return;
    }
    try {
      await createOrder.mutateAsync({
        projectId,
        supplierName: form.supplierName.trim(),
        description: form.description.trim(),
        orderedAt: form.orderedAt || todayIso(),
        expectedAt: form.expectedAt || null,
        notes: null,
      });
      toast.success("Bestellung erfasst");
      setForm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  return (
    <section id="sheet-bestellungen" className="scroll-mt-16 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Bestellungen{orders.length > 0 ? ` (${openCount} offen)` : ""}
        </h3>
        {canEdit && !form ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
            + Bestellung
          </Button>
        ) : null}
      </div>

      {overdueCount > 0 ? (
        <p className="mt-1 text-[11px] font-medium text-orange-700 dark:text-orange-300">
          {overdueCount} Bestellung{overdueCount === 1 ? "" : "en"} seit über {ORDER_OVERDUE_DAYS} Tagen offen.
        </p>
      ) : null}

      {ordersQuery.isLoading ? (
        <div className="flex justify-center py-4" role="status" aria-live="polite">
          <BauflipLoading size="sm" label="Bestellungen werden geladen …" />
        </div>
      ) : null}

      {!ordersQuery.isLoading && orders.length === 0 && !form ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Noch keine Bestellungen erfasst.</p>
      ) : null}

      {orders.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {orders.map((o) => (
            <OrderLineRow
              key={o.id}
              order={o}
              canEdit={canEdit}
              togglePending={setReceived.isPending}
              deletePending={deleteOrder.isPending}
              onToggleReceived={async () => {
                try {
                  await setReceived.mutateAsync({ orderId: o.id, projectId, received: o.receivedAt == null });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
                }
              }}
              onDelete={async () => {
                try {
                  await deleteOrder.mutateAsync({ orderId: o.id, projectId });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
                }
              }}
            />
          ))}
        </ul>
      ) : null}

      {form ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">Lieferant</Label>
              <Input
                value={form.supplierName}
                placeholder="z. B. Muster AG"
                onChange={(e) => setForm((p) => (p ? { ...p, supplierName: e.target.value } : p))}
              />
            </div>
            <div>
              <Label className="text-[11px]">Was wurde bestellt?</Label>
              <Input
                value={form.description}
                placeholder="z. B. Material, 3 Stück"
                onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Bestellt am</Label>
              <Input
                type="date"
                value={form.orderedAt}
                onChange={(e) => setForm((p) => (p ? { ...p, orderedAt: e.target.value } : p))}
              />
            </div>
            <div>
              <Label className="text-[11px]">Erwartet (optional)</Label>
              <Input
                type="date"
                value={form.expectedAt}
                onChange={(e) => setForm((p) => (p ? { ...p, expectedAt: e.target.value } : p))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
              Abbrechen
            </Button>
            <Button type="button" size="sm" disabled={createOrder.isPending} onClick={submit}>
              Speichern
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
