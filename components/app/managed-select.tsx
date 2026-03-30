"use client";

import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ManagedSelectOption = {
  id: string;
  label: string;
  value: string;
  isDeletable: boolean;
};

export type ManagedSelectProps = {
  options: ManagedSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  /** Hinzufügen/Löschen sichtbar (Büro/Admin). */
  manageable?: boolean;
  addDialogTitle?: string;
  addDialogPlaceholder?: string;
  deleteConfirmText?: (option: ManagedSelectOption) => string;
  onAdd: (label: string) => Promise<{ value: string }>;
  onDelete: (option: ManagedSelectOption) => Promise<void>;
  onMutation?: () => void | Promise<void>;
};

export function ManagedSelect({
  options,
  value,
  onChange,
  disabled,
  id,
  name,
  className,
  placeholder = "Bitte wählen …",
  manageable = true,
  addDialogTitle = "Neue Option",
  addDialogPlaceholder = "Bezeichnung …",
  deleteConfirmText = (o) => `Option «${o.label}» entfernen?`,
  onAdd,
  onDelete,
  onMutation,
}: ManagedSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const resolvedLabel = value ? (options.find((o) => o.value === value)?.label ?? value) : "";

  async function handleDelete(opt: ManagedSelectOption) {
    if (!manageable || disabled || !opt.isDeletable) return;
    if (!window.confirm(deleteConfirmText(opt))) return;
    setBusy(true);
    try {
      await onDelete(opt);
      if (value === opt.value) onChange("");
      await onMutation?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const newOpt = await onAdd(label);
      setNewLabel("");
      setAddOpen(false);
      onChange(newOpt.value);
      setOpen(false);
      await onMutation?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled || busy}
            className={cn(
              "flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/50",
              className,
            )}
          >
            <span className={cn("flex flex-1 truncate", !resolvedLabel && "text-muted-foreground")}>
              {resolvedLabel || placeholder}
            </span>
            <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="z-[200] min-w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(100vw-2rem,24rem)] p-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-[min(18rem,calc(100vh-8rem))] overflow-y-auto p-1">
            {options.map((opt) => (
              <div key={opt.id} className="flex min-h-8 items-stretch gap-0 rounded-sm hover:bg-accent/60">
                <button
                  type="button"
                  role="menuitem"
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {value === opt.value ? (
                    <Check className="size-4 shrink-0 opacity-80" aria-hidden />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden />
                  )}
                </button>
                {manageable && opt.isDeletable ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-sm px-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    title="Option entfernen"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDelete(opt);
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                    <span className="sr-only">Entfernen</span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {manageable ? (
            <>
              <DropdownMenuSeparator className="my-0" />
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary outline-none hover:bg-accent focus-visible:bg-accent"
                  disabled={busy}
                  onClick={() => {
                    setAddOpen(true);
                    setOpen(false);
                  }}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  Weitere Option hinzufügen
                </button>
              </div>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <RadixDialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[250] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <RadixDialog.Content
            className="fixed top-1/2 left-1/2 z-[251] w-[min(100%,20rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg outline-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <RadixDialog.Title className="text-sm font-semibold">{addDialogTitle}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Bezeichnung eingeben.</RadixDialog.Description>
            <Input
              className="mt-3 h-9"
              placeholder={addDialogPlaceholder}
              value={newLabel}
              disabled={busy}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setAddOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" size="sm" disabled={busy || !newLabel.trim()} onClick={() => void handleAdd()}>
                Anlegen
              </Button>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}
