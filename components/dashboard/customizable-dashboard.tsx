"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BauflipLoadingInline } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardPageData } from "@/lib/dashboard/page-data";
import { defaultDashboardLayout } from "@/lib/dashboard/default-layout";
import type { DashboardLayout, DashboardWidgetPlacement, WidgetId } from "@/lib/dashboard/types";
import { widgetMeta, widgetsForRole } from "@/lib/dashboard/widget-registry";
import { DashboardWidgetBody } from "@/components/dashboard/dashboard-widget-body";
import { cn } from "@/lib/utils";

type CustomizableDashboardProps = {
  initialLayout: DashboardLayout;
  data: DashboardPageData;
  saveAction: (layout: DashboardLayout) => Promise<void>;
};

function SortableWidget({
  placement,
  editing,
  data,
  onRemove,
}: {
  placement: DashboardWidgetPlacement;
  editing: boolean;
  data: DashboardPageData;
  onRemove: () => void;
}) {
  const meta = widgetMeta(placement.widgetId);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: placement.instanceId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 opacity-60")}>
      <Card>
        <CardHeader className="flex flex-row items-start gap-2 pb-3">
          {editing ? (
            <button
              type="button"
              className="mt-0.5 cursor-grab touch-none rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
              aria-label="Baustein verschieben"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-base">{meta?.title ?? placement.widgetId}</CardTitle>
            {meta?.description ? <CardDescription>{meta.description}</CardDescription> : null}
          </div>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Baustein entfernen"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">
          <DashboardWidgetBody widgetId={placement.widgetId} data={data} />
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomizableDashboard({ initialLayout, data, saveAction }: CustomizableDashboardProps) {
  const [items, setItems] = useState(initialLayout.items);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [addChoice, setAddChoice] = useState<WidgetId | "">("");

  useEffect(() => {
    setItems(initialLayout.items);
  }, [initialLayout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const usedIds = useMemo(() => new Set(items.map((i) => i.widgetId)), [items]);

  const addable = useMemo(() => {
    return widgetsForRole(data.role).filter((w) => !usedIds.has(w.id));
  }, [data.role, usedIds]);

  const persist = useCallback(
    (next: DashboardWidgetPlacement[]) => {
      const layout: DashboardLayout = { version: 1, items: next };
      startTransition(async () => {
        await saveAction(layout);
      });
    },
    [saveAction],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((i) => i.instanceId === active.id);
    const newIndex = items.findIndex((i) => i.instanceId === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    persist(next);
  };

  const removeAt = (instanceId: string) => {
    const next = items.filter((i) => i.instanceId !== instanceId);
    setItems(next);
    persist(next);
  };

  const addWidget = () => {
    if (!addChoice) {
      return;
    }
    const next: DashboardWidgetPlacement[] = [
      ...items,
      { instanceId: crypto.randomUUID(), widgetId: addChoice },
    ];
    setItems(next);
    setAddChoice("");
    persist(next);
  };

  const resetDefault = () => {
    const next = defaultDashboardLayout(data.role).items;
    setItems(next);
    persist(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={editing ? "default" : "outline"}
            size="sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "Bearbeiten beenden" : "Dashboard bearbeiten"}
          </Button>
          {editing ? (
            <span className="text-xs text-muted-foreground">
              Bausteine ziehen, entfernen oder hinzufügen. Änderungen werden gespeichert.
            </span>
          ) : null}
        </div>
        {pending ? <BauflipLoadingInline label="Speichern …" /> : null}
      </div>

      {editing ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Baustein hinzufügen</CardTitle>
            <CardDescription>
              Hier können Sie nur <strong>neue</strong> Bereiche einfügen, die für Ihre Rolle vorgesehen sind und noch{" "}
              <strong>nicht</strong> auf dem Dashboard vorkommen. Diagramme und Kennzahlen (z.&nbsp;B. unter „Betrieb &amp;
              Erfolg“) gehören zu einem bestehenden Baustein — es gibt dafür keinen extra Baustein.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Baustein</span>
              {addable.length > 0 ? (
                <Select
                  value={addChoice || undefined}
                  onValueChange={(v) => {
                    if (v) {
                      setAddChoice(v as WidgetId);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Typ wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Verfügbar</SelectLabel>
                      {addable.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Keine weiteren Baustein-Typen verfügbar.</strong> Für Ihre Rolle sind alle
                  vorgesehenen Bereiche bereits eingefügt. Zum Umsortieren oder Ausblenden: die Karten oben beim Ziehen bzw.
                  Entfernen nutzen — oder „Standard wiederherstellen“.
                </p>
              )}
            </div>
            <Button type="button" size="sm" onClick={addWidget} disabled={!addChoice || addable.length === 0}>
              <Plus className="size-4" />
              Hinzufügen
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={resetDefault}>
              Standard wiederherstellen
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.instanceId)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col">
            {items.map((placement, index) => (
              <div
                key={placement.instanceId}
                className={cn(index > 0 && "mt-4 border-t border-border/90 pt-8")}
              >
                <SortableWidget
                  placement={placement}
                  editing={editing}
                  data={data}
                  onRemove={() => removeAt(placement.instanceId)}
                />
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Bausteine — Standard wiederherstellen oder Baustein hinzufügen.</p>
      ) : null}
    </div>
  );
}
