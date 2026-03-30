"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Paperclip } from "lucide-react";
import { uploadProjectReportFileAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_ALL = `${ACCEPT_IMAGES},application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document`;

export function ReportUploadSection({
  projectId,
  onAfterMutation,
  large = false,
}: {
  projectId: string;
  onAfterMutation: () => void | Promise<void>;
  /** Grössere Buttons für die Monteur-Rapport-Seite. */
  large?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    setUploadError(null);
    setUploadedName(null);
    const fd = new FormData();
    fd.append("projectId", projectId);
    fd.append("file", file);
    startTransition(async () => {
      try {
        await uploadProjectReportFileAction(fd);
        setUploadedName(file.name);
        await onAfterMutation();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
      }
    });
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className={large ? "font-medium text-foreground" : "text-sm font-medium text-foreground"}>
        Foto oder Datei hochladen
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept={ACCEPT_IMAGES}
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size={large ? "default" : "sm"}
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className={large ? "size-5" : "size-4"} aria-hidden />
          Foto aufnehmen
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ALL}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size={large ? "default" : "sm"}
          variant="outline"
          className="gap-2"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className={large ? "size-5" : "size-4"} aria-hidden />
          Datei / Galerie
        </Button>
      </div>
      {pending ? (
        <p className="text-xs text-muted-foreground">Wird hochgeladen …</p>
      ) : uploadedName ? (
        <p className="text-xs text-emerald-700">✓ {uploadedName} hochgeladen</p>
      ) : uploadError ? (
        <p className="text-xs text-destructive">{uploadError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Unterstützt: Fotos (JPG, PNG, WEBP), PDF, Word</p>
      )}
    </div>
  );
}
