"use client";

import { forwardRef, useId, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";

export type FileInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Text auf dem Auswählen-Button. */
  buttonLabel?: string;
  /** Text, wenn noch keine Datei gewählt ist. */
  placeholder?: string;
};

/**
 * Datei-Auswahl im Look der übrigen Buttons statt des rohen Browser-Chroms
 * ("Datei auswählen" / "Choose File" + Systemschrift). Native `<input>` bleibt
 * per `sr-only` erhalten (Tastatur/Screenreader/`ref`/Formular-`name` unverändert
 * nutzbar) — nur sichtbar ist der gestylte Button + Dateiname.
 *
 * Reset: `ref.current.value = ""` von aussen aktualisiert den angezeigten Namen
 * NICHT (kein change-Event). Zum Zurücksetzen den Aufrufer per `key`-Prop auf
 * dieser Komponente neu mounten lassen (siehe zahlungen-page-client.tsx).
 */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { buttonLabel = "Datei wählen", placeholder = "Keine Datei ausgewählt", className, id, onChange, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <input
        ref={ref}
        id={inputId}
        type="file"
        className="sr-only"
        onChange={(e) => {
          setFileName(e.target.files?.[0]?.name ?? null);
          onChange?.(e);
        }}
        {...props}
      />
      <label htmlFor={inputId} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
        <Upload className="size-4" aria-hidden />
        {buttonLabel}
      </label>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{fileName ?? placeholder}</span>
    </div>
  );
});
