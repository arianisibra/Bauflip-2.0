"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { Button } from "@/components/ui/button";

export type SignaturePadHandle = {
  /** PNG-Data-URL oder null, wenn noch nichts gezeichnet wurde. */
  toDataUrl: () => string | null;
  clear: () => void;
};

/**
 * Leichtgewichtiges Unterschriften-Feld (Canvas, Pointer-Events, Retina-skaliert).
 * Kein externes Package — Touch/Stift/Maus über Pointer-Events abgedeckt.
 */
export function SignaturePad({
  handleRef,
  heightPx = 160,
}: {
  handleRef: Ref<SignaturePadHandle>;
  heightPx?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1e";
  }, []);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasStrokesRef.current = false;
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      toDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasStrokesRef.current) return null;
        return canvas.toDataURL("image/png");
      },
      clear,
    }),
    [clear],
  );

  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        style={{ height: heightPx, touchAction: "none" }}
        className="w-full rounded-lg border border-dashed border-border bg-white dark:bg-zinc-100"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          drawingRef.current = true;
          const { x, y } = pointerPos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawingRef.current) return;
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          const { x, y } = pointerPos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          hasStrokesRef.current = true;
        }}
        onPointerUp={() => {
          drawingRef.current = false;
        }}
        onPointerLeave={() => {
          drawingRef.current = false;
        }}
      />
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          Löschen
        </Button>
      </div>
    </div>
  );
}
