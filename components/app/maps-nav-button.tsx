"use client";

import { Navigation } from "lucide-react";

export function MapsNavButton({ address }: { address: string }) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary active:scale-95"
      aria-label="Route in Google Maps öffnen"
    >
      <Navigation className="size-4.5" />
    </a>
  );
}
