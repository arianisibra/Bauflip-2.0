"use client";

import { Navigation } from "lucide-react";

export function MapsNavButton({ address }: { address: string }) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary active:scale-95"
      aria-label="Route in Google Maps öffnen"
    >
      <Navigation className="size-4.5" />
    </button>
  );
}
