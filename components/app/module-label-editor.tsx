"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { BauflipLoadingButtonLabel } from "@/components/ui/bauflip-loading";
import { Button } from "@/components/ui/button";
import { updateModuleLabelAction } from "@/app/(app)/actions";

type ModuleLabelEditorProps = {
  moduleKey: string;
  label: string;
  canEdit: boolean;
};

export function ModuleLabelEditor({ moduleKey, label, canEdit }: ModuleLabelEditorProps) {
  const [value, setValue] = useState(label);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return <h1 className="mt-1 text-2xl font-semibold">{label}</h1>;
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-10 max-w-sm bg-white"
      />
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("key", moduleKey);
            formData.set("label", value);
            await updateModuleLabelAction(formData);
          })
        }
      >
        {isPending ? <BauflipLoadingButtonLabel variant="onPrimary">Speichern…</BauflipLoadingButtonLabel> : "Speichern"}
      </Button>
    </div>
  );
}
